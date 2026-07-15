const { getConfigValue, setConfigValue } = require('../utils/db');
const assert = require('assert');

async function testTriviaConfig() {
  console.log('Running Trivia Config tests...');
  const testQuestions = [
    { questionText: '¿Cuál es el color favorito?', options: ['Rojo', 'Azul', 'Verde'], correctOptionIndex: 1, timeLimit: 15 }
  ];
  await setConfigValue('default', 'trivia_questions', JSON.stringify(testQuestions));
  const saved = await getConfigValue('default', 'trivia_questions', '[]');
  const parsed = JSON.parse(saved);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].correctOptionIndex, 1);
  console.log('Trivia Config tests passed!');
}
testTriviaConfig().catch(err => {
  console.error(err);
  process.exit(1);
});
