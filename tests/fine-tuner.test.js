const assert = require('assert');
const db = require('../utils/db');

async function runFineTunerTests() {
  console.log('🧪 Running Fine-Tuner Unit Tests...');

  const TEST_MODEL = 'card-model-unit-test-isolated';
  const TEST_EVENT = 'test-event-isolated';

  // Test 1: Get Default Fine-Tuner Config
  const defaultConfig = await db.getTemplateFineTuning(TEST_MODEL, TEST_EVENT);
  assert.strictEqual(typeof defaultConfig.paddingTop, 'number');
  assert.strictEqual(typeof defaultConfig.paddingBottom, 'number');
  assert.strictEqual(typeof defaultConfig.maxWidth, 'number');
  console.log('  ✓ Test 1 Passed: Default Fine-Tuner config structure is valid.');

  // Test 2: Save Fine-Tuner Pro Element Config
  const customConfig = {
    paddingTop: 95,
    paddingBottom: 105,
    maxWidth: 280,
    s0TitleSize: 1.80,
    s0TitleOffsetY: -10,
    s0IntroSize: 0.85,
    s0IntroOffsetY: -5,
    s0CountdownSize: 55,
    s0CountdownOffsetX: 15,
    s0CountdownOffsetY: -20,
    s0BtnFontSize: 0.85,
    s0BtnScale: 1.15
  };
  const saved = await db.saveTemplateFineTuning(TEST_MODEL, customConfig, TEST_EVENT);
  assert.strictEqual(saved.paddingTop, 95);
  assert.strictEqual(saved.paddingBottom, 105);
  assert.strictEqual(saved.maxWidth, 280);
  assert.strictEqual(saved.s0TitleSize, 1.80);
  assert.strictEqual(saved.s0TitleOffsetY, -10);
  assert.strictEqual(saved.s0IntroSize, 0.85);
  assert.strictEqual(saved.s0IntroOffsetY, -5);
  assert.strictEqual(saved.s0CountdownSize, 55);
  assert.strictEqual(saved.s0CountdownOffsetX, 15);
  assert.strictEqual(saved.s0CountdownOffsetY, -20);
  assert.strictEqual(saved.s0BtnFontSize, 0.85);
  assert.strictEqual(saved.s0BtnScale, 1.15);
  console.log('  ✓ Test 2 Passed: Fine-Tuner Pro element config saved correctly.');

  // Test 3: Read Back Saved Fine-Tuner Config
  const retrieved = await db.getTemplateFineTuning(TEST_MODEL, TEST_EVENT);
  assert.strictEqual(retrieved.paddingTop, 95);
  assert.strictEqual(retrieved.paddingBottom, 105);
  assert.strictEqual(retrieved.s0TitleSize, 1.80);
  assert.strictEqual(retrieved.s0IntroSize, 0.85);
  assert.strictEqual(retrieved.s0IntroOffsetY, -5);
  assert.strictEqual(retrieved.s0CountdownSize, 55);
  assert.strictEqual(retrieved.s0CountdownOffsetX, 15);
  assert.strictEqual(retrieved.s0CountdownOffsetY, -20);
  assert.strictEqual(retrieved.s0BtnFontSize, 0.85);
  assert.strictEqual(retrieved.s0BtnScale, 1.15);
  console.log('  ✓ Test 3 Passed: Fine-Tuner Pro config retrieved accurately.');

  // Test 4: Save & Retrieve Multi-Slide Custom Configurations
  const multiSlideConfig = {
    s1CalendarScale: 0.70,
    s1CalendarOffsetY: 12,
    s1CalBtnScale: 1.15,
    s1CalBtnOffsetY: -8,
    s1bCardScale: 0.85,
    s2CardScale: 0.90,
    s2BtnScale: 1.10,
    s3CarouselScale: 1.05,
    s4FormScale: 0.95,
    s5CardScale: 1.10,
    s6FormScale: 0.80,
    sfBtnScale: 1.20,
    scrollMoreScale: 1.15,
    scrollMoreOffsetY: -10,
    scrollMoreOffsetX: 5,
    frameVideoUrl: '/uploads/frames/test-frame.mp4',
    frameScale: 1.25,
    frameOffsetY: -15,
    frameOffsetX: 20,
    frameRotate: 45,
    frameOpacity: 0.90,
    frameBlendMode: 'screen'
  };
  await db.saveTemplateFineTuning(TEST_MODEL, multiSlideConfig, TEST_EVENT);
  const multiRetrieved = await db.getTemplateFineTuning(TEST_MODEL, TEST_EVENT);
  assert.strictEqual(multiRetrieved.s1CalendarScale, 0.70);
  assert.strictEqual(multiRetrieved.s1CalendarOffsetY, 12);
  assert.strictEqual(multiRetrieved.s1CalBtnScale, 1.15);
  assert.strictEqual(multiRetrieved.s1CalBtnOffsetY, -8);
  assert.strictEqual(multiRetrieved.s1bCardScale, 0.85);
  assert.strictEqual(multiRetrieved.s2CardScale, 0.90);
  assert.strictEqual(multiRetrieved.s2BtnScale, 1.10);
  assert.strictEqual(multiRetrieved.s3CarouselScale, 1.05);
  assert.strictEqual(multiRetrieved.s4FormScale, 0.95);
  assert.strictEqual(multiRetrieved.s5CardScale, 1.10);
  assert.strictEqual(multiRetrieved.s6FormScale, 0.80);
  assert.strictEqual(multiRetrieved.sfBtnScale, 1.20);
  assert.strictEqual(multiRetrieved.scrollMoreScale, 1.15);
  assert.strictEqual(multiRetrieved.scrollMoreOffsetY, -10);
  assert.strictEqual(multiRetrieved.scrollMoreOffsetX, 5);
  assert.strictEqual(multiRetrieved.frameVideoUrl, '/uploads/frames/test-frame.mp4');
  assert.strictEqual(multiRetrieved.frameScale, 1.25);
  assert.strictEqual(multiRetrieved.frameOffsetY, -15);
  assert.strictEqual(multiRetrieved.frameOffsetX, 20);
  assert.strictEqual(multiRetrieved.frameRotate, 45);
  assert.strictEqual(multiRetrieved.frameOpacity, 0.90);
  assert.strictEqual(multiRetrieved.frameBlendMode, 'screen');
  console.log('  ✓ Test 4 Passed: Multi-slide & Animated Frame Fine-Tuner configurations saved and persisted accurately.');

  // Test 5: Verify Terracotta & Botanical Model Defaults
  const terracottaConfig = await db.getTemplateFineTuning('card-model-terracotta', TEST_EVENT);
  assert.strictEqual(terracottaConfig.frameVideoUrl, '/assets/invitaciones/Terracotta/Terracotta.mp4');

  const botanicalConfig = await db.getTemplateFineTuning('card-model-botanical', TEST_EVENT);
  assert.strictEqual(botanicalConfig.frameVideoUrl, '/assets/invitaciones/Botanical/borderbotanical_vertical.mp4');
  console.log('  ✓ Test 5 Passed: Terracotta & Botanical frame video URL defaults loaded correctly.');

  console.log('✅ ALL FINE-TUNER TESTS PASSED SUCCESSFULLY! 🎨\n');
}

if (require.main === module) {
  runFineTunerTests().catch(err => {
    console.error('❌ Fine-Tuner Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { runFineTunerTests };
