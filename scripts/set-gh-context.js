const fs = require('node:fs');
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
  const tokenPath = path.join(ghConfigDir, 'token.txt');
  const token = fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, 'utf8').trim() : '';

  return {
    GH_CONFIG_DIR: ghConfigDir,
    GH_HOST: 'github.com',
    GH_REPO: 'governada/governada-app',
    GH_TOKEN: token,
    GITHUB_TOKEN: token,
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
    if (context.GH_TOKEN) {
      console.log(`export GH_TOKEN=${shellEscape(context.GH_TOKEN)}`);
      console.log(`export GITHUB_TOKEN=${shellEscape(context.GITHUB_TOKEN)}`);
    }
    return;
  }

  if (format === '--format=json') {
    console.log(JSON.stringify(context, null, 2));
    return;
  }

  console.log(`GH_CONFIG_DIR=${context.GH_CONFIG_DIR}`);
  console.log(`GH_HOST=${context.GH_HOST}`);
  console.log(`GH_REPO=${context.GH_REPO}`);
  if (context.GH_TOKEN) {
    console.log(`GH_TOKEN=${context.GH_TOKEN}`);
    console.log(`GITHUB_TOKEN=${context.GITHUB_TOKEN}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getContext,
};
