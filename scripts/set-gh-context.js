const path = require('node:path');

function getBaseDir() {
  if (process.env.USERPROFILE) {
    return process.env.USERPROFILE;
  }

  if (process.env.HOME) {
    return process.env.HOME;
  }

  return process.cwd();
}

function getContext() {
  const baseDir = getBaseDir();
  const ghConfigDir = path.join(baseDir, '.config', 'gh-governada');

  return {
    GH_CONFIG_DIR: ghConfigDir,
    GH_HOST: 'github.com',
    GH_REPO: 'governada/app',
    OP_ACCOUNT: 'my.1password.com',
  };
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function main() {
  const format = process.argv[2] || '--format=env';
  const context = getContext();

  if (format === '--format=sh') {
    console.log(`export GH_CONFIG_DIR=${shellEscape(context.GH_CONFIG_DIR)}`);
    console.log(`export GH_HOST=${shellEscape(context.GH_HOST)}`);
    console.log(`export GH_REPO=${shellEscape(context.GH_REPO)}`);
    console.log(`export OP_ACCOUNT=${shellEscape(context.OP_ACCOUNT)}`);
    return;
  }

  if (format === '--format=json') {
    console.log(JSON.stringify(context, null, 2));
    return;
  }

  console.log(`GH_CONFIG_DIR=${context.GH_CONFIG_DIR}`);
  console.log(`GH_HOST=${context.GH_HOST}`);
  console.log(`GH_REPO=${context.GH_REPO}`);
  console.log(`OP_ACCOUNT=${context.OP_ACCOUNT}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  getContext,
};
