import Task from '../models/Task';

export function generateTaskCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  const letters = Array.from({ length: 3 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  return `TSK-${digits}-${letters}`;
}

export async function generateUniqueTaskCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateTaskCode();
    const exists = await Task.exists({ taskCode: code });
    if (!exists) return code;
  }
  throw new Error(
    'Failed to generate a unique task code after 5 attempts. Please try again.'
  );
}