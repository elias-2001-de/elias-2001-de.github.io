const correct = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-check-icon lucide-circle-check"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
const info = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info-icon lucide-info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
const error = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-x-icon lucide-circle-x"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>';

function addInput(value) {
    const funcsDiv = document.getElementById("funcs");

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "8px";
    wrapper.style.justifyContent = "center";

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.classList.add("input");
    input.addEventListener('input', (event) => {
        update();
    });

    const div = document.createElement("div");
    div.classList.add("check");
    div.innerHTML = correct;

    wrapper.appendChild(input);
    wrapper.appendChild(div);
    funcsDiv.appendChild(wrapper);
}

async function init() {
    await wasm_bindgen("func_checker_bg.wasm")
    addInput("a&b");
    addInput("!(!a|!b)");
    update();
}

function remove() {
    const funcsDiv = document.getElementById("funcs");
    if (funcsDiv.children.length != 1) {
        funcsDiv.removeChild(funcsDiv.lastElementChild);
    }
}

function update() {
    const funcsDiv = document.getElementById("funcs");

    const fns = [];
    for (let i = 0; i < funcsDiv.children.length; i++) {
        const e = funcsDiv.children.item(i);
        const input = e.getElementsByClassName("input")[0];
        fns.push(input.value);
    }
    const res = wasm_bindgen.check_funcs(fns);

    for (let i = 0; i < funcsDiv.children.length; i++) {
        const e = funcsDiv.children.item(i);
        const check = e.getElementsByClassName("check")[0];
        if (res[i] == null || res[i] == "Correct") {
            check.innerHTML = correct;
        } else if (res[i] == "Wrong") {
            check.innerHTML = error;
        } else {
            check.innerHTML = info;
        }
    }


    try {
        const res = wasm_bindgen.get_table(fns[fns.length - 1]);

        if (res["names"] && res["table"]) {
            generateTruthTable(res.names, res.table);
        } else {
            console.log(res);
        }
    } catch (err) {
        console.log(err);

    }

}

function generateTruthTable(names, table) {
    const container = document.getElementById("table");
    container.innerHTML = ""; // Clear any previous table

    const numVars = names.length;
    const rows = table.length;

    if (rows !== 2 ** numVars) {
        throw new Error("Table length does not match number of variables");
    }

    const htmlTable = document.createElement("table");
    htmlTable.style.borderCollapse = "collapse";
    htmlTable.style.marginTop = "1em";

    const addCell = (tr, text, isHeader = false) => {
        const cell = document.createElement(isHeader ? "th" : "td");
        cell.textContent = text;
        cell.style.border = "1px solid #ccc";
        cell.style.padding = "4px 8px";
        tr.appendChild(cell);
    };

    const headerRow = document.createElement("tr");
    [...names, "Result"].forEach(name => addCell(headerRow, name, true));
    htmlTable.appendChild(headerRow);

    for (let i = 0; i < rows; i++) {
        const binary = i.toString(2).padStart(numVars, "0").split("");
        const result = table[i] ? "1" : "0";

        const row = document.createElement("tr");
        binary.forEach(bit => addCell(row, bit));
        addCell(row, result);
        htmlTable.appendChild(row);
    }

    container.appendChild(htmlTable);
}


function add() {
    const funcsDiv = document.getElementById("funcs");
    const last = funcsDiv.children.item(funcsDiv.children.length - 1);
    addInput(last.getElementsByClassName("input")[0].value);
}
