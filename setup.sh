rm -rf node_modules

# use npm for GitHub Actions
if [ -n "$GITHUB_ACTIONS" ]; then
    echo "Use npm"
    NPM=npm
    npm i
    npm install --include=optional sharp
    npm install --os=linux --cpu=x64 sharp
    npm install --os=win32 --cpu=x64 sharp
else
    echo "Use pnpm"
    NPM=pnpm
    pnpm i
    pnpm install --include=optional sharp
    pnpm install --config.platform=linux --config.architecture=x64 sharp
    pnpm install --config.platform=win32 --config.architecture=x64 sharp
fi


pushd file-server
rm -rf node_modules
$NPM i
popd

pushd webview
rm -rf node_modules
$NPM i
popd