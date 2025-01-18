export class APIKeyDetector {
    constructor() {
      this.API_PATTERNS = [
        {
          name: 'AWS Access Key',
          pattern: /AKIA[0-9A-Z]{16}/g,
          validator: (key) => key.length === 20 && /^AKIA[0-9A-Z]{16}$/.test(key),
          envKey: 'AWS_ACCESS_KEY_ID',
        },
        {
          name: 'AWS Secret Key',
          pattern: /[A-Za-z0-9/+=]{40}/g,
          validator: (key) => key.length === 40 && /^[A-Za-z0-9/+=]{40}$/.test(key),
          envKey: 'AWS_SECRET_ACCESS_KEY',
        },
        {
          name: 'GitHub Token',
          pattern: /gh[oprs]_[A-Za-z0-9_]{36}/g,
          validator: (key) => /^gh[oprs]_[A-Za-z0-9_]{36}$/.test(key),
          envKey: 'GITHUB_TOKEN',
        },
        {
          name: 'OpenAI API Key',
          pattern: /sk-(live|test)-[A-Za-z0-9]{32}/g,
          validator: (key) => /^sk-(live|test)-[A-Za-z0-9]{32}$/.test(key),
          envKey: 'OPENAI_API_KEY',
        },
        {
          name: 'Google Cloud API Key',
          pattern: /AIza[0-9A-Za-z-_]{35}/g,
          validator: (key) => /^AIza[0-9A-Za-z-_]{35}$/.test(key),
          envKey: 'GOOGLE_CLOUD_API_KEY',
        },
        {
          name: 'Stripe API Key',
          pattern: /(?:sk_live|pk_live)_[A-Za-z0-9]{24}/g,
          validator: (key) => /^(sk_live|pk_live)_[A-Za-z0-9]{24}$/.test(key),
          envKey: 'STRIPE_API_KEY',
        },
      ];
    }
  
    detectAPIKeys(text) {
      const detectedKeys = [];
      for (const apiPattern of this.API_PATTERNS) {
        const matches = text.match(apiPattern.pattern);
        if (matches) {
          for (const match of matches) {
            if (apiPattern.validator(match) && this.hasHighEntropy(match)) {
              detectedKeys.push({
                name: apiPattern.name,
                key: match,
                envKey: apiPattern.envKey,
              });
            }
          }
        }
      }
      return detectedKeys;
    }
  
    hasHighEntropy(key) {
      const entropy = this.calculateEntropy(key);
      return entropy > 3.5; // Adjust threshold as needed
    }
  
    calculateEntropy(str) {
      const length = str.length;
      const frequency = Array.from(str).reduce((acc, char) => {
        acc[char] = (acc[char] || 0) + 1;
        return acc;
      }, {});
  
      return Object.values(frequency).reduce((sum, count) => {
        const p = count / length;
        return sum - p * Math.log2(p);
      }, 0);
    }
  }
  