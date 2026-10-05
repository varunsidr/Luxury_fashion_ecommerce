import { randomBytes, scryptSync } from 'node:crypto';

if (process.stdin.isTTY) {
  process.stderr.write('Pipe the password on stdin; this tool does not accept it as a command argument.\n');
  process.exit(2);
}
let password = '';
for await (const chunk of process.stdin) password += chunk.toString('utf8');
password = password.replace(/\r?\n$/, '');
if (password.length < 16) {
  process.stderr.write('Use an admin password of at least 16 characters.\n');
  process.exit(2);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
process.stdout.write(`scrypt:${salt.toString('hex')}:${hash.toString('hex')}\n`);
