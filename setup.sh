rm -rf node_modules
pnpm i
pnpm install --include=optional sharp
pnpm install --config.platform=linux --config.architecture=x64 sharp
pnpm install --config.platform=win32 --config.architecture=x64 sharp


pushd file-server
rm -rf node_modules
pnpm i
popd

pushd webview
rm -rf node_modules
pnpm i
popd