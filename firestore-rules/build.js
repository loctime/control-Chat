const fs = require('fs');
const path = require('path');

const firestoreRulesDir = path.join(__dirname);
const outputFile = path.join(__dirname, '..', 'firestore.rules');

// ORDEN DE CARGA DE REGLAS (IMPORTANTE)
// - helpers/base primero
// - apps específicas después
// - default deny se agrega SOLO AL FINAL
const files = [
  'base.rules',

  // Apps core
  'controlFile.rules',
  'controlgastos.rules',
  'audit.rules',
  'repo.rules',
  'emails.rules',
  'valentin.rules',
  'controlrepo.rules',
  'controlChat.rules',

  // Horarios / Scheduler
  'horarios.rules',

  // Mapping (NUEVO)
  'mapping.rules'
];

// Header Firestore
let content = `rules_version = '2';\n\n`;
content += `service cloud.firestore {\n`;
content += `  match /databases/{db}/documents {\n\n`;

// Concatenar reglas
files.forEach((file) => {
  const filePath = path.join(firestoreRulesDir, file);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Archivo no encontrado: ${file}`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');

  const sectionName = file
    .replace('.rules', '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '');

  content += `    /* ========= ${sectionName} ========= */\n\n`;

  const indentedContent = fileContent
    .split('\n')
    .map(line => (line.trim() === '' ? '    ' : `    ${line}`))
    .join('\n');

  content += indentedContent + '\n\n';
});

// Default deny (ÚNICO Y AL FINAL)
content += `    /* ========= DENY POR DEFECTO ========= */\n\n`;
content += `    match /{document=**} {\n`;
content += `      allow read, write: if false;\n`;
content += `    }\n`;
content += `  }\n`;
content += `}\n`;

// Escribir archivo final
fs.writeFileSync(outputFile, content, 'utf8');

console.log('✅ Reglas de Firestore concatenadas exitosamente en firestore.rules');
console.log(`📝 Total de líneas: ${content.split('\n').length}`);
