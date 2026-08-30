const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'WEB_ORIGIN',
];

const placeholderPatterns = [
  /your-project/i,
  /replace-with/i,
  /localhost/i,
  /example\.com/i,
];

const errors = [];
for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value) {
    errors.push(`${name}: variável ausente`);
    continue;
  }
  if (placeholderPatterns.some((pattern) => pattern.test(value))) {
    errors.push(`${name}: contém valor de exemplo ou desenvolvimento`);
  }
}

const webOrigin = process.env.WEB_ORIGIN;
if (webOrigin && !webOrigin.startsWith('https://')) {
  errors.push('WEB_ORIGIN: produção exige HTTPS');
}

if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  errors.push(
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: uma chave administrativa nunca pode ser pública',
  );
}

if (
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY ===
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
) {
  errors.push('As chaves pública e administrativa não podem ser iguais');
}

if (errors.length) {
  process.stderr.write(
    `Configuração de produção recusada:\n- ${errors.join('\n- ')}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  'Configuração mínima de produção validada sem expor os valores.\n',
);
