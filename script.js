// === FUNGSI PENYEDERHANAAN (SOP) ===
function simplifyToSOP(vars, table) {
  const terms = [];
  for (let i = 0; i < table.length; i++) {
    if (table[i].Y === 1) {
      let term = "";
      for (let j = 0; j < vars.length; j++) {
        term += table[i][vars[j]] ? vars[j] : vars[j] + "'";
      }
      terms.push(term);
    }
  }
  return terms.length ? terms.join(" + ") : "0";
}

// === DROPDOWN CONTOH ===
const scenarioSelect = document.querySelector("#scenario-select");
if (scenarioSelect) {
  scenarioSelect.addEventListener("change", (e) => {
    const expr = e.target.value;
    if (expr) {
      document.querySelector("#expr").value = expr;
      document.querySelector("#validation").textContent = `💡 Contoh dimuat: ${expr}`;
    }
  });
}

// === TOKENIZER (versi final — mendukung A'B', (A+B')C, dll) ===
function tokenize(expr) {
  expr = expr.replace(/\s+/g, "");
  if (!expr.length) throw new Error("Ekspresi kosong!");

  const tokens = [];
  const validVars = /[A-Z]/i;
  let lastType = null;

  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];

    // Variabel
    if (validVars.test(c)) {
      if (lastType === "VAR" || lastType === "PAR_CLOSE" || lastType === "NOT") {
        // Tambahkan AND implisit
        tokens.push({ t: "OP", v: "AND" });
      }
      tokens.push({ t: "VAR", v: c });
      lastType = "VAR";
      continue;
    }

    // NOT
    if (c === "'" || c === "~") {
      if (lastType === "OP" && tokens[tokens.length - 1].v !== "NOT" && tokens[tokens.length - 1].v !== "(")
        throw new Error(`Operator berurutan tanpa operand di posisi ${i}: '${c}'`);
      tokens.push({ t: "OP", v: "NOT" });
      lastType = "NOT"; // biar bisa tangkap pola A'B
      continue;
    }

    // AND
    if (c === "*" || c === "&") {
      if (lastType !== "VAR" && lastType !== "PAR_CLOSE")
        throw new Error(`Operator AND tanpa operand sebelum/ sesudah di posisi ${i}.`);
      tokens.push({ t: "OP", v: "AND" });
      lastType = "OP";
      continue;
    }

    // OR
    if (c === "+" || c === "|") {
    if (lastType !== "VAR" && lastType !== "PAR_CLOSE" && lastType !== "NOT")
        throw new Error(`Operator OR tanpa operand sebelum/ sesudah di posisi ${i}.`);
    tokens.push({ t: "OP", v: "OR" });
    lastType = "OP";
    continue;
    }


    // XOR
    if (c === "^") {
      if (lastType !== "VAR" && lastType !== "PAR_CLOSE")
        throw new Error(`Operator XOR tanpa operand sebelum/ sesudah di posisi ${i}.`);
      tokens.push({ t: "OP", v: "XOR" });
      lastType = "OP";
      continue;
    }

    // Kurung buka
    if (c === "(") {
      if (lastType === "VAR" || lastType === "PAR_CLOSE" || lastType === "NOT") {
        // AND implisit sebelum kurung
        tokens.push({ t: "OP", v: "AND" });
      }
      tokens.push({ t: "PAR", v: "(" });
      lastType = "PAR_OPEN";
      continue;
    }

    // Kurung tutup
    if (c === ")") {
      if (lastType === "OP" || lastType === "PAR_OPEN")
        throw new Error(`Ekspresi kosong atau operator di dalam kurung di posisi ${i}.`);
      tokens.push({ t: "PAR", v: ")" });
      lastType = "PAR_CLOSE";
      continue;
    }

    throw new Error(`Karakter tidak dikenal: '${c}' di posisi ${i}.`);
  }

  // Tidak boleh diakhiri dengan operator
  if (lastType === "OP" || lastType === "PAR_OPEN")
    throw new Error("Ekspresi diakhiri dengan operator atau kurung buka tanpa penutup.");

  return tokens;
}





// === KONVERSI KE RPN (dengan deteksi kurung tidak seimbang) ===
function toRPN(tokens) {
  const prec = { NOT: 3, AND: 2, OR: 1, XOR: 1 };
  const out = [], stack = [];
  let balance = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.t === "VAR") {
      out.push(t);
    }

    else if (t.t === "OP") {
      if (t.v === "NOT") {
        stack.push(t);
      } else {
        while (stack.length && stack[stack.length - 1].t === "OP" &&
          prec[stack[stack.length - 1].v] >= prec[t.v]) {
          out.push(stack.pop());
        }
        stack.push(t);
      }
    }

    else if (t.t === "PAR") {
      if (t.v === "(") {
        stack.push(t);
        balance++;
      } else {
        balance--;
        if (balance < 0) throw new Error("Kurung tutup berlebih atau tidak seimbang.");
        while (stack.length && stack[stack.length - 1].v !== "(") {
          out.push(stack.pop());
        }
        if (!stack.length) throw new Error("Kurung buka tidak ditemukan.");
        stack.pop();
      }
    }
  }

  if (balance !== 0) throw new Error("Kurung buka dan tutup tidak seimbang.");
  while (stack.length) out.push(stack.pop());
  return out;
}



// === EVALUASI RPN ===
function evalRPN(rpn, vars) {
  const st = [];
  for (const t of rpn) {
    if (t.t === "VAR") st.push(vars[t.v] || 0);
    else if (t.t === "OP") {
      if (t.v === 'NOT') {
        const a = st.pop();
        st.push(!a);
      } else {
        const b = st.pop(), a = st.pop();
        if (t.v === 'AND') st.push(a && b);
        else if (t.v === 'OR') st.push(a || b);
        else if (t.v === 'XOR') st.push(Boolean(a) !== Boolean(b));
      }
    }
  }
  return st.pop() ? 1 : 0;
}

// === MENDAPATKAN VARIABEL ===
function getVars(tokens) {
  return [...new Set(tokens.filter(t => t.t === "VAR").map(t => t.v))];
}

// === BUAT TABEL KEBENARAN ===
function makeTable(vars, rpn) {
  const n = vars.length, rows = [];
  for (let i = 0; i < (1 << n); i++) {
    const combo = {};
    for (let j = 0; j < n; j++) {
      combo[vars[j]] = (i >> ((n - 1) - j)) & 1;
    }
    const Y = evalRPN(rpn, combo);
    rows.push({ ...combo, Y });
  }
  return rows;
}

// === TOMBOL EVALUASI ===
document.querySelector("#btn-eval").onclick = () => {
  const expr = document.querySelector("#expr").value.trim();
  if (!expr) return;

  try {
    const tokens = tokenize(expr);
    const vars = getVars(tokens);
    const rpn = toRPN(tokens);
    const table = makeTable(vars, rpn);

    let html = `<table><tr>${vars.map(v => `<th>${v}</th>`).join("")}<th>Y</th></tr>`;
    for (const row of table) {
      html += `<tr>${vars.map(v => `<td>${row[v]}</td>`).join("")}<td>${row.Y}</td></tr>`;
    }
    html += `</table>`;
    document.querySelector("#ttarea").innerHTML = html;

    document.querySelector("#validation").innerHTML = "✅ Evaluasi berhasil tanpa error.";
    document.querySelector("#vars-pill").textContent = "Variabel: " + (vars.length ? vars.join(", ") : "—");

    const minterms = [];
    for (let i = 0; i < table.length; i++) if (table[i].Y === 1) minterms.push(i);
    document.querySelector("#minterms-pill").textContent = "Minterm: " + (minterms.length ? minterms.join(",") : "—");

    const simplified = simplifyToSOP(vars, table);
    document.querySelector("#simp-pill").innerHTML = "Sederhana: " + simplified;

  } catch (e) {
    // 🔴 Kalau error, tampilkan pesan dan kosongkan hasil-hasil lain
    document.querySelector("#validation").innerHTML = `<span style="color:#f87171;font-weight:600;">❌ Kesalahan:</span> ${e.message}`;
    document.querySelector("#ttarea").innerHTML = "<div class='muted caption'>Siap — masukkan ekspresi dan klik Evaluasi.</div>";
    document.querySelector("#vars-pill").textContent = "Variabel: —";
    document.querySelector("#minterms-pill").textContent = "Minterm: —";
    document.querySelector("#simp-pill").textContent = "Sederhana: —";
  }
};


// === TOMBOL BERSIHKAN ===
document.querySelector("#btn-clear").onclick = () => {
  document.querySelector("#expr").value = "";
  document.querySelector("#ttarea").innerHTML = "<div class='muted caption'>Siap — masukkan ekspresi dan klik Evaluasi.</div>";
  document.querySelector("#validation").textContent = "Siap — masukkan ekspresi dan klik Evaluasi.";
  document.querySelector("#vars-pill").textContent = "Variabel: —";
  document.querySelector("#minterms-pill").textContent = "Minterm: —";
  document.querySelector("#simp-pill").textContent = "Sederhana: —";
};

// === BAGIAN K-MAP ===
const inputMinterm = document.getElementById("minterm-io");
const btnImport = document.getElementById("btn-import");
const btnExport = document.getElementById("btn-export");
const btnSimplify = document.getElementById("btn-simplify");
const btnReset = document.getElementById("btn-reset");
const outSimplified = document.getElementById("out-simplified");
const kvars = document.getElementById("kvars");
const kmapWrap = document.getElementById("kmapWrap");

let minterms = [];
let dontCares = [];
let variables = ["A", "B", "C", "D"];

function renderKmap() {
  const varCount = 4;
  kvars.textContent = variables.slice(0, varCount).join(", ");
  const gray = [0, 1, 3, 2];

  let html = `<table class="kmap-horizontal"><tbody>`;
  for (let r = 0; r < 4; r++) {
    html += "<tr>";
    for (let c = 0; c < 4; c++) {
      const idx = (gray[r] << 2) | gray[c];
      let cls = "kmap-cell";
      let val = "0";
      if (minterms.includes(idx)) { cls += " on"; val = "1"; }
      else if (dontCares.includes(idx)) { cls += " dc"; val = "d"; }
      html += `<td class="${cls}" data-idx="${idx}">${val}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  kmapWrap.innerHTML = html;

  document.querySelectorAll(".kmap-cell").forEach(cell => {
    cell.addEventListener("click", () => {
      const idx = parseInt(cell.getAttribute("data-idx"));
      if (minterms.includes(idx)) {
        minterms = minterms.filter(x => x !== idx);
        dontCares.push(idx);
      } else if (dontCares.includes(idx)) {
        dontCares = dontCares.filter(x => x !== idx);
      } else {
        minterms.push(idx);
      }
      renderKmap();
    });
  });
}

function simplifyKmap() {
  const varCount = 4;
  const varsUsed = variables.slice(0, varCount);
  const table = [];
  for (let i = 0; i < 16; i++) {
    const combo = {};
    for (let j = 0; j < varCount; j++) {
      combo[varsUsed[j]] = (i >> ((varCount - 1) - j)) & 1;
    }
    combo.Y = minterms.includes(i) ? 1 : 0;
    table.push(combo);
  }
  const simplified = simplifyToSOP(varsUsed, table);
  outSimplified.textContent = simplified;
}

function resetKmap() {
  minterms = [];
  dontCares = [];
  inputMinterm.value = "";
  outSimplified.textContent = "—";
  kmapWrap.innerHTML = "K-Map akan muncul di sini.";
}

btnImport.addEventListener("click", () => {
  const val = inputMinterm.value.trim();
  if (!val) return;
  const tokens = val.split(",").map(v => v.trim());
  minterms = tokens.filter(v => !v.startsWith("d")).map(v => parseInt(v));
  dontCares = tokens.filter(v => v.startsWith("d")).map(v => parseInt(v.substring(1)));
  renderKmap();
});

btnExport.addEventListener("click", () => {
  const dPart = dontCares.length ? ",d" + dontCares.join(",d") : "";
  inputMinterm.value = minterms.join(",") + dPart;
});

btnSimplify.addEventListener("click", simplifyKmap);
btnReset.addEventListener("click", resetKmap);

// Render awal
renderKmap();
