import fs from 'fs';
import * as dotenv from 'dotenv';
import path from 'path';

export const getEnvFile = () => {
  const dir = fs.readdirSync(process.cwd());
  const baseEnvFile = dir.find((e) => e === '.env');
  const envFile = baseEnvFile || dir.find((e) => e.startsWith('.env'));
  if (envFile) {
    const filePath = path.join(process.cwd(), envFile);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return {
      content: dotenv.parse(fileContent),
      path: path.join(process.cwd(), envFile),
    };
  }
};

export const getEnvValue = (key: string) => {
  const file = getEnvFile();
  return file?.content[key];
};
