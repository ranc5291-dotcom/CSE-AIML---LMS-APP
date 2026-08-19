const fs = require('fs');
const path = 'src/pages/FacultyDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

let count = 0;
content = content.replace(/\n(\s*)\n(\s*)href=\{(note|a)\.fileUrl\}/g, (match, p1, p2, id) => {
  count++;
  return `\n${p1}<` + `a\n${p2}href={${id}.fileUrl}`;
});

fs.writeFileSync(path, content, 'utf8');
console.log(`Fixed ${count} occurrence(s).`);