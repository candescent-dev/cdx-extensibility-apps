const fs = require('fs');
const path = require('path');
const pkgRoots = [
  path.join(__dirname, '../../node_modules/@mui/material'),
  path.join(__dirname, '../../node_modules/@mui/icons-material'),
  path.join(__dirname, '../../node_modules/@mui/system'),
];

for (const pkgRoot of pkgRoots) {
  const esmPkgPath = path.join(pkgRoot, 'esm/package.json');
  const rootPkgPath = path.join(pkgRoot, 'package.json');

  if (fs.existsSync(esmPkgPath)) {
    const esmPkg = JSON.parse(fs.readFileSync(esmPkgPath, 'utf-8'));
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    if (!esmPkg.version && rootPkg.version) {
      esmPkg.version = rootPkg.version;
      fs.writeFileSync(esmPkgPath, JSON.stringify(esmPkg, null, 2));
      console.log(`✅ Patched MUI ESM version to ${rootPkg.version}`);
    }
  }
}