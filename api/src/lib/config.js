const PLACEHOLDER_PATTERN = /replace|your_|<[^>]+>|changeme|example|missing|undefined/i;

const configurationProblems = () => {
  const problems = [];
  const requireValue = (name, minimumLength = 1) => {
    const value = String(process.env[name] || '');
    if (value.length < minimumLength || PLACEHOLDER_PATTERN.test(value)) problems.push(name);
    return value;
  };

  requireValue('MONGODB_URI', 20);
  requireValue('MONGODB_DB_NAME', 1);
  requireValue('ADMIN_API_KEY', 32);
  requireValue('AUTH_SESSION_SECRET', 32);
  const razorpayKeyId = requireValue('RAZORPAY_KEY_ID', 12);
  requireValue('RAZORPAY_KEY_SECRET', 16);
  requireValue('RAZORPAY_WEBHOOK_SECRET', 16);
  if (razorpayKeyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(razorpayKeyId)) problems.push('RAZORPAY_KEY_ID_FORMAT');

  return [...new Set(problems)];
};

const assertProductionConfig = () => {
  if (process.env.NODE_ENV !== 'production') return;
  const problems = configurationProblems();
  if (problems.length) {
    throw new Error(`Production configuration is incomplete: ${problems.join(', ')}`);
  }
};

module.exports = { assertProductionConfig, configurationProblems };
