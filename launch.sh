pushd file-server
npm run start &

popd

pushd webview
npm run serve &
npm run build --watch &

popd
