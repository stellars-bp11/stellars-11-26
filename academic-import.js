/*
 * STELLARS Academic Results Importer
 *
 * Reads Excel/CSV and text-based PDF files in the browser.
 * The source file is never uploaded or stored in Firestore.
 * Assessment names are detected dynamically from the selected header row.
 */

import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    setDoc,
    updateDoc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD3ptwKTkLqFCmvrTVJFooFiVLE63mh83c",
    authDomain: "class-web-7241e.firebaseapp.com",
    projectId: "class-web-7241e",
    storageBucket: "class-web-7241e.firebasestorage.app",
    messagingSenderId: "167560389153",
    appId: "1:167560389153:web:f61f4f821275c48373f960",
    measurementId: "G-DTHTZNT135"
};

let auth = null;
let db = null;

const SHEETJS_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.worker.mjs";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const WRITE_BATCH_SIZE = 400;

const el = (id) => document.getElementById(id);

const workspace = el("academicImportWorkspace");
const openWorkspaceButton = el("openAcademicWorkspace");
const closeWorkspaceButton = el("closeAcademicWorkspace");
const fileInput = el("academicResultsFile");
const importStatus = el("academicImportStatus");
const mappingPanel = el("academicMappingPanel");
const sheetField = el("academicSheetField");
const sheetSelect = el("academicSheetSelect");
const headerRowInput = el("academicHeaderRow");
const subjectInput = el("academicSubjectName");
const nameColumnSelect = el("academicNameColumn");
const nimColumnSelect = el("academicNimColumn");
const examDateInput = el("academicExamDate");
const assessmentColumns = el("academicAssessmentColumns");
const reviewSummary = el("academicReviewSummary");
const reviewTable = el("academicReviewTable");
const saveDraftButton = el("saveAcademicDrafts");
const resetImportButton = el("resetAcademicImport");
const historyContainer = el("academicImportHistory");

let activeProfile = null;
let activeUser = null;
let rosterByNim = new Map();
let rosterPromise = null;
let workbook = null;
let currentGrid = [];
let currentFile = null;
let currentRows = [];
let assessmentDefinitions = [];
let selectedNameColumn = "";
let selectedNimColumn = "";
let listenersBound = false;
let isSaving = false;

function setImportStatus(message, type = "info") {
    if (!importStatus) return;
    importStatus.textContent = message;
    importStatus.dataset.type = type;
}

function normalizeNim(value) {
    return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeName(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function cellText(value) {
    if (value === null || value === undefined) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toLocaleDateString("id-ID");
    }
    return String(value).trim();
}

function fileBaseName(fileName) {
    return String(fileName || "Imported Subject").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function friendlyError(error) {
    const code = error?.code ? error.code + ": " : "";
    return code + (error?.message || "An unexpected error occurred.");
}

function canPublish() {
    if (!activeProfile || activeProfile.isActive !== true) return false;
    if (activeProfile.role === "superAdmin") return true;
    return activeProfile.role === "admin" && activeProfile.canPublish === true;
}

function hasAdminRole(profile) {
    return !!profile && profile.isActive === true &&
        ["admin", "superAdmin"].includes(profile.role);
}

function canDeleteUpload(uploadData) {
    if (!hasAdminRole(activeProfile) || !uploadData) return false;

    if (uploadData.status === "published") return canPublish();

    if (uploadData.status === "deleting") {
        return uploadData.deletionRequiresPublisher === true
            ? canPublish()
            : true;
    }

    return ["ready", "failed"].includes(uploadData.status);
}

function categoryFromAssessmentName(name) {
    const cleaned = String(name || "").trim();
    return cleaned.replace(/\s*[\(\[]?\d+[\)\]]?\s*$/, "").trim() || cleaned || "Assessment";
}

async function loadRoster() {
    if (rosterPromise) return rosterPromise;

    rosterPromise = (async () => {
        const snapshot = await getDocs(collection(db, "nimIndex"));
        const nextRoster = new Map();

        snapshot.forEach((memberDoc) => {
            const data = memberDoc.data() || {};
            const nim = normalizeNim(memberDoc.id);
            if (nim && data.uid && data.isActive === true) {
                nextRoster.set(nim, {
                    uid: String(data.uid),
                    fullName: String(data.fullName || ""),
                    isActive: true
                });
            }
        });

        rosterByNim = nextRoster;
        return rosterByNim;
    })().catch((error) => {
        rosterPromise = null;
        throw error;
    });

    return rosterPromise;
}

function bindWorkspaceEvents() {
    if (listenersBound) return;
    listenersBound = true;

    // Workspace open/close controls are handled by academic.js.
    // This module manages only parsing, Firestore drafts, and publication.

    fileInput?.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (file) await readSelectedFile(file);
    });

    sheetSelect?.addEventListener("change", () => {
        if (!workbook) return;
        loadSelectedWorksheet(sheetSelect.value);
    });

    headerRowInput?.addEventListener("change", () => {
        buildMappingFromGrid();
    });

    nameColumnSelect?.addEventListener("change", () => {
        selectedNameColumn = nameColumnSelect.value;
        currentRows.forEach((row) => {
            row.name = selectedNameColumn === "" ? "" : cellText(row.cells[Number(selectedNameColumn)]);
        });
        buildAssessmentDefinitions();
        renderReview();
    });

    nimColumnSelect?.addEventListener("change", () => {
        selectedNimColumn = nimColumnSelect.value;
        currentRows.forEach((row) => {
            row.nim = selectedNimColumn === "" ? "" : cellText(row.cells[Number(selectedNimColumn)]);
        });
        buildAssessmentDefinitions();
        renderReview();
    });

    assessmentColumns?.addEventListener("change", (event) => {
        const checkbox = event.target.closest("[data-assessment-enabled]");
        const maxScoreInput = event.target.closest("[data-assessment-max]");
        if (checkbox) {
            const definition = assessmentDefinitions.find((item) => item.columnIndex === Number(checkbox.dataset.assessmentEnabled));
            if (definition) definition.enabled = checkbox.checked;
            renderReview();
        } else if (maxScoreInput) {
            const definition = assessmentDefinitions.find((item) => item.columnIndex === Number(maxScoreInput.dataset.assessmentMax));
            if (definition) definition.maxScore = maxScoreInput.value;
            renderReview();
        }
    });

    reviewTable?.addEventListener("change", (event) => {
        const includeInput = event.target.closest("[data-row-include]");
        const nimInput = event.target.closest("[data-row-nim]");
        const scoreInput = event.target.closest("[data-row-score]");
        const rowIndex = Number(event.target.dataset.rowIndex);

        if (!Number.isInteger(rowIndex) || !currentRows[rowIndex]) return;

        if (includeInput) {
            currentRows[rowIndex].include = includeInput.checked;
        } else if (nimInput) {
            currentRows[rowIndex].nim = nimInput.value.trim();
        } else if (scoreInput) {
            const columnIndex = Number(scoreInput.dataset.rowScore);
            currentRows[rowIndex].values[columnIndex] = scoreInput.value;
        }

        renderReview();
    });

    saveDraftButton?.addEventListener("click", saveCurrentDraft);
    resetImportButton?.addEventListener("click", resetCurrentImport);

    historyContainer?.addEventListener("click", async (event) => {
        const publishButton = event.target.closest("[data-publish-upload]");
        if (publishButton) {
            await publishSavedUpload(publishButton.dataset.publishUpload, publishButton);
            return;
        }

        const deleteButton = event.target.closest("[data-delete-upload]");
        if (deleteButton) {
            await deleteSavedUpload(deleteButton.dataset.deleteUpload, deleteButton);
        }
    });
}

export function initAcademicImport(profile, user) {
    if (!hasAdminRole(profile) || !user) return;

    const sharedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(sharedApp);
    db = getFirestore(sharedApp);

    activeProfile = profile;
    activeUser = user;
    bindWorkspaceEvents();

    refreshImportHistory();

    loadRoster()
        .then(() => {
            setImportStatus("Student roster loaded: " + rosterByNim.size + " active accounts are available for matching.", "success");
            renderReview();
        })
        .catch((error) => {
            console.error("Unable to load STELLARS student roster:", error);
            setImportStatus("Student roster could not be loaded. " + friendlyError(error), "error");
        });
}

async function readSelectedFile(file) {
    if (file.size > MAX_FILE_SIZE) {
        setImportStatus("This file is larger than 15 MB. Please choose a smaller file.", "error");
        fileInput.value = "";
        return;
    }

    currentFile = file;
    workbook = null;
    currentGrid = [];
    currentRows = [];
    assessmentDefinitions = [];
    mappingPanel.hidden = true;
    setImportStatus("Reading " + file.name + "…");

    try {
        const extension = file.name.split(".").pop().toLowerCase();

        if (extension === "pdf") {
            currentGrid = await extractPdfGrid(file);
            sheetField.hidden = true;
        } else if (["xlsx", "xls", "csv"].includes(extension)) {
            const XLSX = await import(SHEETJS_URL);
            const buffer = await file.arrayBuffer();
            workbook = XLSX.read(buffer, {
                type: "array",
                cellDates: true,
                dense: false
            });

            if (!workbook.SheetNames?.length) {
                throw new Error("No worksheet was found in this file.");
            }

            sheetSelect.replaceChildren();
            workbook.SheetNames.forEach((sheetName) => {
                const option = document.createElement("option");
                option.value = sheetName;
                option.textContent = sheetName;
                sheetSelect.appendChild(option);
            });

            sheetField.hidden = workbook.SheetNames.length <= 1;
            loadSelectedWorksheet(workbook.SheetNames[0]);
            subjectInput.value = fileBaseName(file.name);
            mappingPanel.hidden = false;
            setImportStatus("File read successfully. Confirm the header row and column mapping below.", "success");
            return;
        } else {
            throw new Error("Unsupported format. Choose an .xlsx, .xls, .csv, or .pdf file.");
        }

        if (!currentGrid.length) {
            throw new Error("No readable table rows were found in this PDF.");
        }

        subjectInput.value = fileBaseName(file.name);
        headerRowInput.value = "1";
        mappingPanel.hidden = false;
        buildMappingFromGrid();
        setImportStatus(
            "PDF text extracted into " + currentGrid.length + " row(s). Check the preview carefully because PDF column spacing can vary.",
            "success"
        );
    } catch (error) {
        console.error("Academic results file parsing failed:", error);
        mappingPanel.hidden = true;
        setImportStatus(
            error?.message?.includes("No text could be extracted")
                ? "This PDF appears to be scanned or image-only. It needs selectable text to be imported automatically."
                : "Could not read this file. " + friendlyError(error),
            "error"
        );
    }
}

function loadSelectedWorksheet(sheetName) {
    if (!workbook || !sheetName) return;

    import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs")
        .then((XLSX) => {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) throw new Error("The selected worksheet is unavailable.");
            currentGrid = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                raw: false,
                defval: "",
                blankrows: false
            });
            headerRowInput.value = "1";
            mappingPanel.hidden = false;
            if (!subjectInput.value.trim() || workbook.SheetNames.length > 1) {
                subjectInput.value = workbook.SheetNames.length > 1
                    ? sheetName
                    : fileBaseName(currentFile?.name || sheetName);
            }
            buildMappingFromGrid();
            setImportStatus(
                "Worksheet \"" + sheetName + "\" loaded with " + currentGrid.length + " row(s).",
                "success"
            );
        })
        .catch((error) => {
            console.error("Could not load worksheet:", error);
            setImportStatus("Could not load the selected worksheet. " + friendlyError(error), "error");
        });
}

async function extractPdfGrid(file) {
    const pdfjs = await import(PDFJS_URL);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

    const documentTask = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer())
    });
    const pdf = await documentTask.promise;
    const grid = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const tokens = (textContent.items || [])
            .filter((item) => typeof item.str === "string" && item.str.trim())
            .map((item) => ({
                text: item.str.trim(),
                x: Number(item.transform?.[4] || 0),
                y: Number(item.transform?.[5] || 0),
                width: Number(item.width || 0),
                height: Number(item.height || 0)
            }));

        const lines = [];
        tokens.forEach((token) => {
            let line = lines.find((candidate) => Math.abs(candidate.y - token.y) <= 2.5);
            if (!line) {
                line = { y: token.y, tokens: [] };
                lines.push(line);
            }
            line.tokens.push(token);
        });

        lines.sort((a, b) => b.y - a.y);

        for (const line of lines) {
            line.tokens.sort((a, b) => a.x - b.x);
            const cells = [];
            let previousEnd = null;

            for (const token of line.tokens) {
                const gap = previousEnd === null ? 0 : token.x - previousEnd;
                if (!cells.length || gap > Math.max(18, token.height * 1.5)) {
                    cells.push(token.text);
                } else {
                    cells[cells.length - 1] += " " + token.text;
                }
                previousEnd = token.x + token.width;
            }

            if (cells.some((cell) => String(cell).trim())) grid.push(cells);
        }
    }

    if (!grid.length) {
        throw new Error("No text could be extracted from this PDF. It may be scanned or image-only.");
    }

    return grid;
}

function buildMappingFromGrid() {
    if (!currentGrid.length) return;

    const headerIndex = Number(headerRowInput.value) - 1;
    if (!Number.isInteger(headerIndex) || headerIndex < 0 || headerIndex >= currentGrid.length) {
        setImportStatus("Header row must point to a row that exists in the imported file.", "error");
        mappingPanel.hidden = false;
        saveDraftButton.disabled = true;
        return;
    }

    const headers = currentGrid[headerIndex] || [];
    nameColumnSelect.replaceChildren();
    nimColumnSelect.replaceChildren();

    const namePlaceholder = document.createElement("option");
    namePlaceholder.value = "";
    namePlaceholder.textContent = "Choose a column";
    nameColumnSelect.appendChild(namePlaceholder);

    const nimPlaceholder = document.createElement("option");
    nimPlaceholder.value = "";
    nimPlaceholder.textContent = "Choose a column";
    nimColumnSelect.appendChild(nimPlaceholder);

    headers.forEach((header, index) => {
        const label = cellText(header) || ("Column " + columnLabel(index));
        const nameOption = document.createElement("option");
        nameOption.value = String(index);
        nameOption.textContent = columnLabel(index) + " — " + label;
        nameColumnSelect.appendChild(nameOption);

        const nimOption = document.createElement("option");
        nimOption.value = String(index);
        nimOption.textContent = columnLabel(index) + " — " + label;
        nimColumnSelect.appendChild(nimOption);
    });

    const nameMatch = headers.findIndex((header) => /nama|name|student/i.test(cellText(header)));
    const nimMatch = headers.findIndex((header) => /\bnim\b|nomor induk|student\s*id|registration/i.test(cellText(header)));

    selectedNameColumn = nameMatch >= 0 ? String(nameMatch) : "";
    selectedNimColumn = nimMatch >= 0 ? String(nimMatch) : "";
    nameColumnSelect.value = selectedNameColumn;
    nimColumnSelect.value = selectedNimColumn;

    currentRows = [];
    for (let index = headerIndex + 1; index < currentGrid.length; index += 1) {
        const cells = currentGrid[index] || [];
        if (!cells.some((value) => cellText(value) !== "")) continue;
        currentRows.push({
            sourceRow: index + 1,
            cells,
            include: true,
            nim: selectedNimColumn === "" ? "" : cellText(cells[Number(selectedNimColumn)]),
            name: selectedNameColumn === "" ? "" : cellText(cells[Number(selectedNameColumn)]),
            values: {}
        });
    }

    buildAssessmentDefinitions();
    renderReview();
}

function columnLabel(index) {
    let number = index + 1;
    let label = "";
    while (number > 0) {
        const remainder = (number - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        number = Math.floor((number - 1) / 26);
    }
    return label;
}

function buildAssessmentDefinitions() {
    const headerIndex = Number(headerRowInput.value) - 1;
    const headers = currentGrid[headerIndex] || [];
    const previous = new Map(assessmentDefinitions.map((item) => [item.columnIndex, item]));

    assessmentDefinitions = headers
        .map((header, columnIndex) => {
            const name = cellText(header) || ("Column " + columnLabel(columnIndex));
            const normalizedHeader = name.toLowerCase().trim();
            const isStudentColumn = String(columnIndex) === selectedNameColumn ||
                String(columnIndex) === selectedNimColumn;
            const isOtherMetadata = /^(no\.?|nomor|number|kelas|class|program|jurusan|student\s*id|registration)$/i.test(normalizedHeader);
            if (isStudentColumn || isOtherMetadata) return null;

            const old = previous.get(columnIndex);
            return {
                columnIndex,
                name,
                category: categoryFromAssessmentName(name),
                enabled: old ? old.enabled : true,
                maxScore: old ? old.maxScore : "100"
            };
        })
        .filter(Boolean);

    assessmentColumns.replaceChildren();

    if (!assessmentDefinitions.length) {
        const message = document.createElement("p");
        message.className = "academic-import-muted";
        message.textContent = "No assessment columns detected. Check the header row or student column mapping.";
        assessmentColumns.appendChild(message);
        return;
    }

    assessmentDefinitions.forEach((definition) => {
        const row = document.createElement("div");
        row.className = "academic-assessment-option";

        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = definition.enabled;
        checkbox.dataset.assessmentEnabled = String(definition.columnIndex);

        const title = document.createElement("span");
        title.textContent = definition.name + " (" + columnLabel(definition.columnIndex) + ")";
        label.append(checkbox, title);

        const maxScore = document.createElement("input");
        maxScore.type = "number";
        maxScore.min = "0.01";
        maxScore.max = "100";
        maxScore.step = "any";
        maxScore.value = String(definition.maxScore);
        maxScore.title = "Maximum score for " + definition.name;
        maxScore.setAttribute("aria-label", "Maximum score for " + definition.name);
        maxScore.dataset.assessmentMax = String(definition.columnIndex);

        row.append(label, maxScore);
        assessmentColumns.appendChild(row);
    });
}

function parseScore(rawValue) {
    const raw = cellText(rawValue);
    if (!raw || ["-", "—", "–", "n/a", "na", "null"].includes(raw.toLowerCase())) {
        return { value: null, valid: true, blank: true };
    }

    const normalized = raw.replace(/%$/, "").replace(/\s/g, "").replace(",", ".");
    const value = Number(normalized);

    if (!Number.isFinite(value)) return { value: null, valid: false, blank: false };
    return { value, valid: true, blank: false };
}

function selectedAssessments() {
    return assessmentDefinitions.filter((item) => item.enabled);
}

function validateRows() {
    const includedRows = currentRows.filter((row) => row.include);
    const counts = new Map();

    includedRows.forEach((row) => {
        const key = normalizeNim(row.nim);
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });

    const results = new Map();
    let errorRows = 0;
    let warningRows = 0;
    let matchedRows = 0;
    const definitions = selectedAssessments();

    for (let index = 0; index < currentRows.length; index += 1) {
        const row = currentRows[index];

        if (!row.include) {
            results.set(index, { state: "skipped", label: "Skipped", errors: [] });
            continue;
        }

        const nim = normalizeNim(row.nim);
        const member = nim ? rosterByNim.get(nim) : null;
        const errors = [];
        let warning = false;

        if (!nim) errors.push("Missing NIM");
        else if (!member) errors.push("NIM not found in active roster");
        else if (counts.get(nim) > 1) errors.push("Duplicate NIM in this file");

        if (member && !row.name) {
            warning = true;
        } else if (member && normalizeName(row.name) !== normalizeName(member.fullName)) {
            warning = true;
        }

        for (const definition of definitions) {
            const raw = Object.prototype.hasOwnProperty.call(row.values, definition.columnIndex)
                ? row.values[definition.columnIndex]
                : row.cells[definition.columnIndex];
            const parsed = parseScore(raw);
            const maximum = Number(definition.maxScore);

            if (!Number.isFinite(maximum) || maximum <= 0 || maximum > 100) {
                errors.push("Invalid maximum score for " + definition.name);
            } else if (!parsed.valid || (!parsed.blank && (parsed.value < 0 || parsed.value > maximum))) {
                errors.push("Invalid score for " + definition.name);
            }
        }

        if (errors.length) errorRows += 1;
        else if (warning) warningRows += 1;
        if (member && !errors.length) matchedRows += 1;

        results.set(index, {
            state: errors.length ? "error" : warning ? "warning" : "matched",
            label: errors.length ? errors[0] : warning ? (!row.name ? "Name missing" : "Name differs") : "Matched",
            errors
        });
    }

    return {
        results,
        errorRows,
        warningRows,
        matchedRows,
        selectedRows: includedRows.length,
        assessmentCount: definitions.length
    };
}

function renderReview() {
    if (!mappingPanel || mappingPanel.hidden) return;

    const definitions = selectedAssessments();
    const validation = validateRows();

    reviewTable.replaceChildren();

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Use", "File row", "NIM", "Student name", "Roster match", ...definitions.map((item) => item.name)].forEach((label) => {
        const th = document.createElement("th");
        th.textContent = label;
        headRow.appendChild(th);
    });
    head.appendChild(headRow);
    reviewTable.appendChild(head);

    const body = document.createElement("tbody");

    currentRows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        const status = validation.results.get(rowIndex) || { state: "error", label: "Not checked" };

        const useCell = document.createElement("td");
        const include = document.createElement("input");
        include.type = "checkbox";
        include.checked = row.include;
        include.dataset.rowIndex = String(rowIndex);
        include.dataset.rowInclude = "true";
        include.setAttribute("aria-label", "Include source row " + row.sourceRow);
        useCell.appendChild(include);

        const sourceCell = document.createElement("td");
        sourceCell.textContent = String(row.sourceRow);

        const nimCell = document.createElement("td");
        const nimInput = document.createElement("input");
        nimInput.type = "text";
        nimInput.value = row.nim;
        nimInput.dataset.rowIndex = String(rowIndex);
        nimInput.dataset.rowNim = "true";
        nimInput.setAttribute("aria-label", "NIM for row " + row.sourceRow);
        nimCell.appendChild(nimInput);

        const nameCell = document.createElement("td");
        nameCell.textContent = row.name || "—";

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = "academic-match-status" +
            (status.state === "error" ? " is-error" : status.state === "warning" || status.state === "skipped" ? " is-warning" : "");
        badge.textContent = status.label;
        if (status.errors?.length > 1) badge.title = status.errors.join("; ");
        statusCell.appendChild(badge);

        tr.append(useCell, sourceCell, nimCell, nameCell, statusCell);

        definitions.forEach((definition) => {
            const cell = document.createElement("td");
            const scoreInput = document.createElement("input");
            scoreInput.type = "text";
            scoreInput.inputMode = "decimal";
            const raw = Object.prototype.hasOwnProperty.call(row.values, definition.columnIndex)
                ? row.values[definition.columnIndex]
                : row.cells[definition.columnIndex];
            scoreInput.value = cellText(raw);
            scoreInput.dataset.rowIndex = String(rowIndex);
            scoreInput.dataset.rowScore = String(definition.columnIndex);
            scoreInput.setAttribute("aria-label", definition.name + " score for " + (row.name || "source row " + row.sourceRow));
            cell.appendChild(scoreInput);
            tr.appendChild(cell);
        });

        body.appendChild(tr);
    });

    reviewTable.appendChild(body);

    const hasValidSubject = !!subjectInput.value.trim();
    const hasValidAssessmentCount = definitions.length > 0;
    const canSave = currentRows.length > 0 &&
        validation.selectedRows > 0 &&
        validation.errorRows === 0 &&
        hasValidSubject &&
        hasValidAssessmentCount &&
        !!selectedNameColumn &&
        !!selectedNimColumn &&
        !isSaving;

    reviewSummary.dataset.type = validation.errorRows ? "error" : validation.warningRows ? "info" : "success";
    reviewSummary.textContent =
        validation.selectedRows + " row(s) selected · " +
        validation.matchedRows + " matched · " +
        validation.warningRows + " name warning(s) · " +
        validation.errorRows + " row(s) need correction · " +
        definitions.length + " assessment component(s). " +
        (validation.errorRows ? "Fix the highlighted rows or uncheck rows that are not student records." :
            validation.warningRows ? "Name differences are warnings; verify them before saving." :
                "The preview is ready to be saved as a draft.");

    saveDraftButton.disabled = !canSave;
}

function resetCurrentImport() {
    currentFile = null;
    workbook = null;
    currentGrid = [];
    currentRows = [];
    assessmentDefinitions = [];
    selectedNameColumn = "";
    selectedNimColumn = "";
    fileInput.value = "";
    subjectInput.value = "";
    examDateInput.value = "";
    mappingPanel.hidden = true;
    setImportStatus("No file selected yet.");
    reviewTable.replaceChildren();
    reviewSummary.textContent = "Select a file to begin.";
    saveDraftButton.disabled = true;
}

async function commitInChunks(operations) {
    for (let offset = 0; offset < operations.length; offset += WRITE_BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = operations.slice(offset, offset + WRITE_BATCH_SIZE);
        chunk.forEach((operation) => {
            if (operation.type === "update") {
                batch.update(operation.ref, operation.data);
            } else if (operation.type === "delete") {
                batch.delete(operation.ref);
            } else if (operation.type === "merge") {
                batch.set(operation.ref, operation.data, { merge: true });
            } else {
                batch.set(operation.ref, operation.data);
            }
        });
        await batch.commit();
    }
}

async function saveCurrentDraft() {
    if (isSaving || !activeUser || !activeProfile) return;

    const validation = validateRows();
    const definitions = selectedAssessments();
    const subjectName = subjectInput.value.trim();

    if (!subjectName || !definitions.length || validation.errorRows > 0 || !validation.selectedRows) {
        renderReview();
        setImportStatus("Correct the review issues before saving this draft.", "error");
        return;
    }

    isSaving = true;
    saveDraftButton.disabled = true;
    saveDraftButton.innerHTML = '<i class="bx bx-loader-alt bx-spin" aria-hidden="true"></i><span>Saving draft…</span>';

    let uploadRef = null;

    try {
        await loadRoster();

        const includedRows = currentRows.filter((row) => row.include);
        const verifiedRows = includedRows.map((row) => ({
            row,
            member: rosterByNim.get(normalizeNim(row.nim))
        }));

        const duplicateSubjectSnapshot = await getDocs(query(
            collection(db, "subjects"),
            where("subjectName", "==", subjectName),
            limit(1)
        ));

        let subjectRef;
        let subjectExists = false;
        if (!duplicateSubjectSnapshot.empty) {
            subjectRef = duplicateSubjectSnapshot.docs[0].ref;
            subjectExists = true;
        } else {
            subjectRef = doc(collection(db, "subjects"));
        }

        uploadRef = doc(collection(db, "uploads"));
        await setDoc(uploadRef, {
            fileName: currentFile?.name || "Imported results",
            fileType: currentFile?.name.split(".").pop().toLowerCase() || "unknown",
            status: "processing",
            uploadedBy: activeUser.uid,
            createdAt: serverTimestamp(),
            subjectName,
            subjectCount: 1,
            assessmentCount: definitions.length,
            rowCount: includedRows.length,
            issueCount: 0
        });

        const operations = [{
            type: subjectExists ? "merge" : "set",
            ref: subjectRef,
            data: {
                subjectName,
                isActive: true,
                sourceUploadId: uploadRef.id,
                updatedBy: activeUser.uid,
                updatedAt: serverTimestamp(),
                ...(subjectExists ? {} : {
                    subjectCode: "",
                    createdBy: activeUser.uid,
                    createdAt: serverTimestamp()
                })
            }
        }];

        const assessmentRefs = new Map();
        definitions.forEach((definition) => {
            const assessmentRef = doc(collection(db, "assessments"));
            assessmentRefs.set(definition.columnIndex, assessmentRef);
            operations.push({
                type: "set",
                ref: assessmentRef,
                data: {
                    subjectId: subjectRef.id,
                    subjectName,
                    assessmentName: definition.name,
                    category: definition.category,
                    maxScore: Number(definition.maxScore),
                    isPublished: false,
                    examDate: examDateInput.value || null,
                    sourceUploadId: uploadRef.id,
                    createdBy: activeUser.uid,
                    createdAt: serverTimestamp()
                }
            });
        });

        for (const { row, member } of verifiedRows) {
            for (const definition of definitions) {
                const raw = Object.prototype.hasOwnProperty.call(row.values, definition.columnIndex)
                    ? row.values[definition.columnIndex]
                    : row.cells[definition.columnIndex];
                const parsed = parseScore(raw);
                const assessmentRef = assessmentRefs.get(definition.columnIndex);

                const scoreRef = doc(collection(db, "scores"));
                operations.push({
                    type: "set",
                    ref: scoreRef,
                    data: {
                        studentId: member.uid,
                        subjectId: subjectRef.id,
                        subjectName,
                        assessmentId: assessmentRef.id,
                        assessmentName: definition.name,
                        score: parsed.value,
                        maxScore: Number(definition.maxScore),
                        isPublished: false,
                        examDate: examDateInput.value || null,
                        sourceUploadId: uploadRef.id,
                        createdAt: serverTimestamp(),
                        publishedAt: null
                    }
                });
            }
        }

        await commitInChunks(operations);

        await updateDoc(uploadRef, {
            status: "ready",
            subjectCount: 1,
            assessmentCount: definitions.length,
            rowCount: includedRows.length,
            issueCount: 0,
            completedAt: serverTimestamp()
        });

        try {
            await setDoc(doc(collection(db, "activityLogs")), {
                actorUid: activeUser.uid,
                action: "academic_import_saved_as_draft",
                uploadId: uploadRef.id,
                createdAt: serverTimestamp(),
                description: "Saved " + includedRows.length + " student row(s) and " + definitions.length + " assessment component(s) as an unpublished draft."
            });
        } catch (logError) {
            console.warn("Academic import activity log was not saved:", logError);
        }

        const successMessage = "Draft saved successfully: " + includedRows.length + " student(s), " +
            definitions.length + " assessment component(s). No grades are visible to students yet.";
        resetCurrentImport();
        setImportStatus(successMessage, "success");
        await refreshImportHistory();
    } catch (error) {
        console.error("Could not save Academic draft:", error);
        if (uploadRef) {
            try {
                await updateDoc(uploadRef, {
                    status: "failed",
                    failureMessage: String(error?.message || "Draft import failed.").slice(0, 300),
                    failedAt: serverTimestamp()
                });
            } catch (statusError) {
                console.warn("Could not update failed import status:", statusError);
            }
        }
        setImportStatus(
            "Draft was not fully saved. Check the Firestore error before retrying. " + friendlyError(error),
            "error"
        );
    } finally {
        isSaving = false;
        saveDraftButton.innerHTML = '<i class="bx bx-save" aria-hidden="true"></i><span>Save as Draft</span>';
        renderReview();
    }
}

function timestampToDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function displayDate(value) {
    const date = timestampToDate(value);
    if (!date) return "Date unavailable";
    return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

async function refreshImportHistory() {
    if (!historyContainer) return;
    historyContainer.replaceChildren();

    try {
        const snapshot = await getDocs(query(
            collection(db, "uploads"),
            orderBy("createdAt", "desc"),
            limit(15)
        ));

        if (snapshot.empty) {
            const empty = document.createElement("p");
            empty.className = "academic-import-muted";
            empty.textContent = "No academic imports yet. Your saved drafts will appear here.";
            historyContainer.appendChild(empty);
            return;
        }

        snapshot.forEach((uploadDoc) => {
            const data = uploadDoc.data() || {};
            const row = document.createElement("article");
            row.className = "academic-import-history-row";

            const main = document.createElement("div");
            main.className = "academic-import-history-main";

            const title = document.createElement("strong");
            title.textContent = data.subjectName || data.fileName || "Academic import";

            const details = document.createElement("small");
            details.textContent =
                (data.fileName || "File") + " · " +
                Number(data.rowCount || 0) + " student row(s) · " +
                Number(data.assessmentCount || 0) + " assessment(s) · " +
                displayDate(data.createdAt);
            main.append(title, details);

            const actions = document.createElement("div");
            actions.className = "academic-import-history-actions";

            const status = document.createElement("span");
            status.className = "academic-import-status-pill";
            status.textContent = String(data.status || "unknown").replace(/_/g, " ");
            actions.appendChild(status);

            if (data.status === "ready" && canPublish()) {
                const publishButton = document.createElement("button");
                publishButton.type = "button";
                publishButton.className = "academic-publish-button";
                publishButton.textContent = "Publish";
                publishButton.dataset.publishUpload = uploadDoc.id;
                actions.appendChild(publishButton);
            } else if (data.status === "ready" && !canPublish()) {
                const pending = document.createElement("small");
                pending.className = "academic-import-muted";
                pending.textContent = "Publisher approval required";
                actions.appendChild(pending);
            }

            if (canDeleteUpload(data)) {
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "academic-delete-button";
                deleteButton.textContent = data.status === "deleting"
                    ? "Retry Delete"
                    : data.status === "published"
                        ? "Delete Published"
                        : "Delete Draft";
                deleteButton.dataset.deleteUpload = uploadDoc.id;
                actions.appendChild(deleteButton);
            } else if (data.status === "published" && hasAdminRole(activeProfile)) {
                const pendingDelete = document.createElement("small");
                pendingDelete.className = "academic-import-muted";
                pendingDelete.textContent = "Publisher approval required to delete";
                actions.appendChild(pendingDelete);
            }

            row.append(main, actions);
            historyContainer.appendChild(row);
        });
    } catch (error) {
        console.error("Could not load Academic import history:", error);
        const message = document.createElement("p");
        message.className = "academic-import-muted";
        message.textContent = "Import history could not be loaded. " + friendlyError(error);
        historyContainer.appendChild(message);
    }
}

async function publishSavedUpload(uploadId, button) {
    if (!canPublish() || !activeUser || !uploadId) {
        setImportStatus("This account does not have permission to publish results.", "error");
        return;
    }

    const confirmed = window.confirm(
        "Publish all draft grades in this import? Students with matching accounts will be able to see their own published scores."
    );
    if (!confirmed) return;

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Publishing…";

    try {
        const [assessmentsSnapshot, scoresSnapshot, uploadSnapshot] = await Promise.all([
            getDocs(query(collection(db, "assessments"), where("sourceUploadId", "==", uploadId))),
            getDocs(query(collection(db, "scores"), where("sourceUploadId", "==", uploadId))),
            getDoc(doc(db, "uploads", uploadId))
        ]);

        if (!uploadSnapshot.exists()) throw new Error("Import record was not found.");
        if (uploadSnapshot.data().status !== "ready") {
            throw new Error("Only a ready draft can be published.");
        }
        if (assessmentsSnapshot.empty || scoresSnapshot.empty) {
            throw new Error("This import does not contain both assessment and score records.");
        }

        const operations = [];
        assessmentsSnapshot.forEach((item) => {
            operations.push({
                type: "update",
                ref: item.ref,
                data: {
                    isPublished: true,
                    publishedAt: serverTimestamp(),
                    publishedBy: activeUser.uid
                }
            });
        });
        scoresSnapshot.forEach((item) => {
            operations.push({
                type: "update",
                ref: item.ref,
                data: {
                    isPublished: true,
                    publishedAt: serverTimestamp()
                }
            });
        });

        await commitInChunks(operations);

        await updateDoc(doc(db, "uploads", uploadId), {
            status: "published",
            publishedAt: serverTimestamp(),
            publishedBy: activeUser.uid
        });

        try {
            await setDoc(doc(collection(db, "activityLogs")), {
                actorUid: activeUser.uid,
                action: "academic_import_published",
                uploadId,
                createdAt: serverTimestamp(),
                description: "Published " + assessmentsSnapshot.size + " assessment(s) and " + scoresSnapshot.size + " student score record(s)."
            });
        } catch (logError) {
            console.warn("Academic publish activity log was not saved:", logError);
        }

        setImportStatus("Results published successfully. Students can now see only their own published scores.", "success");
        await refreshImportHistory();
    } catch (error) {
        console.error("Could not publish Academic import:", error);
        setImportStatus(
            "Publishing failed. Check that the signed-in account has publishing permission and that the latest Firestore Rules are active. " + friendlyError(error),
            "error"
        );
        button.disabled = false;
        button.textContent = originalLabel;
    }
}

async function deleteSavedUpload(uploadId, button) {
    if (!activeUser || !hasAdminRole(activeProfile) || !uploadId) {
        setImportStatus("This account does not have permission to delete academic results.", "error");
        return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Checking…";

    try {
        const uploadRef = doc(db, "uploads", uploadId);
        const [uploadSnapshot, assessmentsSnapshot, scoresSnapshot] = await Promise.all([
            getDoc(uploadRef),
            getDocs(query(collection(db, "assessments"), where("sourceUploadId", "==", uploadId))),
            getDocs(query(collection(db, "scores"), where("sourceUploadId", "==", uploadId)))
        ]);

        if (!uploadSnapshot.exists()) throw new Error("Import history record was not found.");

        const uploadData = uploadSnapshot.data() || {};
        if (uploadData.status === "deleted") {
            throw new Error("This import has already been deleted.");
        }

        if (!["ready", "failed", "published", "deleting"].includes(uploadData.status)) {
            throw new Error("Only saved drafts, published imports, or interrupted deletions can be deleted.");
        }

        const hasPublishedRecords =
            assessmentsSnapshot.docs.some((item) => item.data()?.isPublished === true) ||
            scoresSnapshot.docs.some((item) => item.data()?.isPublished === true);

        const requiresPublisher =
            uploadData.status === "published" ||
            uploadData.deletionRequiresPublisher === true ||
            hasPublishedRecords;

        if (requiresPublisher && !canPublish()) {
            throw new Error("Deleting published results requires Super Admin or an admin with publishing permission.");
        }
        if (!requiresPublisher && !hasAdminRole(activeProfile)) {
            throw new Error("An active admin account is required to delete this draft.");
        }

        if (requiresPublisher) {
            const confirmed = window.confirm(
                "PERMANENT ACTION: This will remove the published assessment components and student scores from this import. Students will no longer be able to see these results. The import history will remain as a deleted audit record."
            );
            if (!confirmed) return;

            const typedConfirmation = window.prompt(
                'Type DELETE to confirm removal of "' + (uploadData.subjectName || uploadData.fileName || "this import") + '".'
            );
            if (typedConfirmation !== "DELETE") {
                setImportStatus("Deletion cancelled. The confirmation text did not match.", "info");
                return;
            }
        } else {
            const confirmed = window.confirm(
                "Delete this draft and all assessment components and score records belonging to it? Students cannot see draft results. The import history will remain as a deleted audit record."
            );
            if (!confirmed) return;
        }

        button.textContent = "Deleting…";

        if (uploadData.status !== "deleting") {
            await updateDoc(uploadRef, {
                status: "deleting",
                previousStatus: uploadData.status,
                deletionRequiresPublisher: requiresPublisher,
                deletionStartedAt: serverTimestamp(),
                deletionStartedBy: activeUser.uid
            });
        }

        if (requiresPublisher) {
            // Withdraw published records first so students cannot see a partial result
            // set while a large import is being removed in multiple Firestore batches.
            const withdrawalOperations = [];
            assessmentsSnapshot.forEach((item) => {
                if (item.data()?.isPublished === true) {
                    withdrawalOperations.push({
                        type: "update",
                        ref: item.ref,
                        data: {
                            isPublished: false,
                            withdrawnAt: serverTimestamp(),
                            withdrawnBy: activeUser.uid
                        }
                    });
                }
            });
            scoresSnapshot.forEach((item) => {
                if (item.data()?.isPublished === true) {
                    withdrawalOperations.push({
                        type: "update",
                        ref: item.ref,
                        data: {
                            isPublished: false,
                            withdrawnAt: serverTimestamp(),
                            withdrawnBy: activeUser.uid
                        }
                    });
                }
            });
            await commitInChunks(withdrawalOperations);
        }

        const deleteOperations = [];
        assessmentsSnapshot.forEach((item) => {
            deleteOperations.push({ type: "delete", ref: item.ref });
        });
        scoresSnapshot.forEach((item) => {
            deleteOperations.push({ type: "delete", ref: item.ref });
        });

        await commitInChunks(deleteOperations);

        await updateDoc(uploadRef, {
            status: "deleted",
            deletedAt: serverTimestamp(),
            deletedBy: activeUser.uid,
            deletedAssessmentCount: assessmentsSnapshot.size,
            deletedScoreCount: scoresSnapshot.size,
            deletionRequiresPublisher: requiresPublisher
        });

        try {
            await setDoc(doc(collection(db, "activityLogs")), {
                actorUid: activeUser.uid,
                action: "academic_import_deleted",
                uploadId,
                createdAt: serverTimestamp(),
                description:
                    "Deleted " + assessmentsSnapshot.size + " assessment(s) and " +
                    scoresSnapshot.size + " score record(s) from a " +
                    (requiresPublisher ? "published" : "draft") +
                    " import. Import history retained for audit."
            });
        } catch (logError) {
            console.warn("Academic import deletion activity log was not saved:", logError);
        }

        setImportStatus(
            (requiresPublisher ? "Published results" : "Draft results") +
            " deleted successfully. The import history remains marked as deleted.",
            "success"
        );
        await refreshImportHistory();
    } catch (error) {
        console.error("Could not delete Academic import:", error);
        setImportStatus(
            "Deletion did not finish. If the history shows 'deleting', use Retry Delete after checking the error. " +
            friendlyError(error),
            "error"
        );
        await refreshImportHistory();
    } finally {
        button.disabled = false;
        button.textContent = originalLabel;
    }
}