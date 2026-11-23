// Run npm run build first. Use a separate Ring session for a standalone example.
const { connectRing } = require('../dist/model/ringWrapper');

connectRing(async ({ name, status }) => {
  console.log(name, status);
});
