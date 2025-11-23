npm install
. ../setEnv.sh
npm run build
redis-server &
jest --detectOpenHandles --coverage src/**/*.test.ts
