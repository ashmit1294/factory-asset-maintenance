import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import { errorResponse } from '@/lib/apiHelper';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Basic validation
    if (!email?.trim() || !password?.trim()) {
      throw new ValidationError('Email and password are required');
    }

    await connectDB();

    // Find user with passwordHash included (it's select: false by default)
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash');

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated');
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Sign JWT
    const token = signToken({
      _id: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
    });

    return NextResponse.json(
      {
        data: {
          token,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}