const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 1. Verify Data File Integrity
const dataPath = path.join(__dirname, '../public/js/complementos-data.js');
assert.ok(fs.existsSync(dataPath), 'El archivo complementos-data.js debe existir');

const { COMPLEMENTOS_DATA } = require('../public/js/complementos-data.js');
assert.ok(Array.isArray(COMPLEMENTOS_DATA), 'COMPLEMENTOS_DATA debe ser un array');
assert.ok(COMPLEMENTOS_DATA.length >= 8, 'Debe haber al menos 8 complementos cargados');

COMPLEMENTOS_DATA.forEach(item => {
  assert.ok(item.id && typeof item.id === 'string', `Cada ítem debe tener un ID válido: ${JSON.stringify(item)}`);
  assert.ok(item.title && typeof item.title === 'string', `Ítem ${item.id} debe tener un título`);
  assert.ok(typeof item.price === 'number' && item.price > 0, `Ítem ${item.id} debe tener un precio numérico positivo`);
  assert.ok(item.priceFormatted && item.priceFormatted.startsWith('$'), `Ítem ${item.id} debe tener priceFormatted`);
  assert.ok(item.category && typeof item.category === 'string', `Ítem ${item.id} debe tener categoría`);
  assert.ok(Array.isArray(item.includes) && item.includes.length > 0, `Ítem ${item.id} debe tener lista de qué incluye`);
  assert.ok(item.requirements, `Ítem ${item.id} debe tener requisitos especificados`);
});

console.log('✔ Verificación de integridad de datos de Complementos exitosa (' + COMPLEMENTOS_DATA.length + ' ítems validados).');

// 2. Verify HTML & CSS files exist
assert.ok(fs.existsSync(path.join(__dirname, '../public/complementos.html')), 'complementos.html debe existir');
assert.ok(fs.existsSync(path.join(__dirname, '../public/css/complementos.css')), 'complementos.css debe existir');
assert.ok(fs.existsSync(path.join(__dirname, '../public/js/complementos.js')), 'complementos.js debe existir');

// 3. Verify Landing page contains Complementos link and section
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
assert.ok(indexHtml.includes('href="#complementos"'), 'index.html debe tener el enlace a #complementos en la navbar');
assert.ok(indexHtml.includes('id="complementos"'), 'index.html debe tener la sección #complementos');
assert.ok(indexHtml.includes('href="/complementos"'), 'index.html debe tener el enlace a /complementos');

console.log('✔ Verificación de estructura de archivos y enlaces en index.html exitosa.');
console.log('✔ ¡Todos los tests de Complementos pasaron exitosamente!');
