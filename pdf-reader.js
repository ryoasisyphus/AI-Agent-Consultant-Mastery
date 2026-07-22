(() => {
  "use strict";

  const DB_NAME = "learning-os-reader";
  const DB_VERSION = 1;
  const DOCUMENT_STORE = "documents";
  const TEXT_STORE = "pageText";
  let pdfJsPromise;
  let mountSequence = 0;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DOCUMENT_STORE)) database.createObjectStore(DOCUMENT_STORE, { keyPath: "templateId" });
        if (!database.objectStoreNames.contains(TEXT_STORE)) database.createObjectStore(TEXT_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function databaseRequest(storeName, mode, operation) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  const getRecord = (storeName, key) => databaseRequest(storeName, "readonly", (store) => store.get(key));
  const putRecord = (storeName, value) => databaseRequest(storeName, "readwrite", (store) => store.put(value));
  const deleteRecord = (storeName, key) => databaseRequest(storeName, "readwrite", (store) => store.delete(key));

  async function deletePageText(prefix) {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(TEXT_STORE, "readwrite");
      const store = transaction.objectStore(TEXT_STORE);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(prefix)) cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }

  function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = import("./vendor/pdfjs/pdf.mjs").then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.mjs", document.baseURI).href;
        return pdfjs;
      });
    }
    return pdfJsPromise;
  }

  function joinTextItems(items) {
    const lines = [];
    let line = "";
    let previousY = null;
    for (const item of items) {
      if (!item.str) continue;
      const currentY = Math.round(item.transform?.[5] || 0);
      if (previousY !== null && Math.abs(currentY - previousY) > 3 && line.trim()) {
        lines.push(line.trim());
        line = "";
      }
      const previousCharacter = line.at(-1) || "";
      const nextCharacter = item.str[0] || "";
      const needsSpace = /[A-Za-z0-9)]/.test(previousCharacter) && /[A-Za-z0-9(]/.test(nextCharacter);
      line += `${needsSpace ? " " : ""}${item.str}`;
      if (item.hasEOL && line.trim()) {
        lines.push(line.trim());
        line = "";
      }
      previousY = currentY;
    }
    if (line.trim()) lines.push(line.trim());
    return lines.join("\n");
  }

  function mount(options) {
    const root = document.querySelector("#lessonReader");
    if (!root || !window.indexedDB) return;
    const mountId = ++mountSequence;
    const isActive = () => mountId === mountSequence && root.isConnected;
    const startPage = Number(options.startPage) || 1;
    const endPage = Number(options.endPage) || startPage;
    const status = root.querySelector("#readerStatus");
    const fileInput = root.querySelector("#readerFile");
    const chooseButton = root.querySelector("#chooseReaderFile");
    const replaceButton = root.querySelector("#replaceReaderFile");
    const removeButton = root.querySelector("#removeReaderFile");
    const fileSummary = root.querySelector("#readerFileSummary");
    const textView = root.querySelector("#readerTextView");
    const textContent = root.querySelector("#readerTextContent");
    const pdfView = root.querySelector("#readerPdfView");
    const canvas = root.querySelector("#readerCanvas");
    const pageInput = root.querySelector("#readerPage");
    const previousButton = root.querySelector("#readerPrevious");
    const nextButton = root.querySelector("#readerNext");
    let pdfDocument;
    let currentPage = startPage;
    let fingerprint = "";
    let renderTask;

    const setStatus = (message, kind = "") => {
      if (!isActive()) return;
      status.textContent = message;
      status.dataset.kind = kind;
    };

    const setDocumentControls = (hasDocument) => {
      root.classList.toggle("has-document", hasDocument);
      root.querySelectorAll("[data-reader-view]").forEach((button) => { button.disabled = !hasDocument; });
      replaceButton.hidden = !hasDocument;
      removeButton.hidden = !hasDocument;
      chooseButton.hidden = hasDocument;
    };

    const showView = (view) => {
      const showPdf = view === "pdf";
      textView.hidden = showPdf;
      pdfView.hidden = !showPdf;
      root.querySelectorAll("[data-reader-view]").forEach((button) => {
        const selected = button.dataset.readerView === view;
        button.setAttribute("aria-pressed", String(selected));
      });
      if (showPdf && pdfDocument) void renderPage(currentPage);
    };

    const updatePageControls = () => {
      pageInput.value = String(currentPage);
      pageInput.max = String(pdfDocument?.numPages || endPage);
      previousButton.disabled = !pdfDocument || currentPage <= 1;
      nextButton.disabled = !pdfDocument || currentPage >= pdfDocument.numPages;
    };

    async function renderPage(pageNumber) {
      if (!pdfDocument || !isActive()) return;
      currentPage = Math.min(pdfDocument.numPages, Math.max(1, Number(pageNumber) || startPage));
      updatePageControls();
      renderTask?.cancel();
      try {
        setStatus(`正在顯示第 ${currentPage} 頁…`);
        const page = await pdfDocument.getPage(currentPage);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(280, pdfView.clientWidth - 28);
        const cssScale = Math.min(1.7, availableWidth / baseViewport.width);
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: cssScale });
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const context = canvas.getContext("2d", { alpha: false });
        renderTask = page.render({ canvasContext: context, viewport, transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0] });
        await renderTask.promise;
        setStatus(`第 ${currentPage} 頁，共 ${pdfDocument.numPages} 頁`, "success");
      } catch (error) {
        if (error?.name !== "RenderingCancelledException") setStatus("這一頁暫時無法顯示，請重試。", "error");
      }
    }

    async function extractRange() {
      textContent.replaceChildren();
      let extractedCharacters = 0;
      const finalPage = Math.min(endPage, pdfDocument.numPages);
      for (let pageNumber = startPage; pageNumber <= finalPage; pageNumber += 1) {
        if (!isActive()) return;
        setStatus(`正在整理課程文字：第 ${pageNumber} / ${finalPage} 頁…`);
        const cacheId = `${options.templateId}:${fingerprint}:${pageNumber}`;
        let record = await getRecord(TEXT_STORE, cacheId);
        if (!record) {
          const page = await pdfDocument.getPage(pageNumber);
          const pageText = joinTextItems((await page.getTextContent()).items);
          record = { id: cacheId, text: pageText };
          await putRecord(TEXT_STORE, record);
        }
        extractedCharacters += record.text.length;
        const section = element("section", "lesson-page");
        const heading = element("div", "lesson-page-heading");
        heading.append(element("strong", "", `第 ${pageNumber} 頁`));
        const jump = element("button", "reader-page-jump", "在 PDF 查看");
        jump.type = "button";
        jump.addEventListener("click", () => { currentPage = pageNumber; showView("pdf"); });
        heading.append(jump);
        section.append(heading);
        const paragraph = element("p", "lesson-page-text", record.text || "這一頁沒有可擷取的文字，可切換到 PDF 頁面閱讀影像內容。");
        section.append(paragraph);
        textContent.append(section);
      }
      setStatus(extractedCharacters ? `課程文字已整理完成，第 ${startPage}–${finalPage} 頁。` : "這份 PDF 可能是掃描影像，請切換到 PDF 頁面閱讀。", extractedCharacters ? "success" : "warning");
    }

    async function openDocument(record) {
      try {
        setDocumentControls(true);
        fileSummary.textContent = `${record.name} · ${(record.size / 1024 / 1024).toFixed(1)} MB · 只存於此瀏覽器`;
        setStatus("正在開啟本機教材…");
        const pdfjs = await loadPdfJs();
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(await record.blob.arrayBuffer()),
          cMapUrl: new URL("./vendor/pdfjs/cmaps/", document.baseURI).href,
          cMapPacked: true,
          standardFontDataUrl: new URL("./vendor/pdfjs/standard_fonts/", document.baseURI).href,
          wasmUrl: new URL("./vendor/pdfjs/wasm/", document.baseURI).href,
          isEvalSupported: false,
          enableXfa: false
        });
        pdfDocument = await loadingTask.promise;
        if (!isActive()) return;
        if (startPage > pdfDocument.numPages) throw new Error(`教材只有 ${pdfDocument.numPages} 頁，無法開啟第 ${startPage} 頁。`);
        fingerprint = pdfDocument.fingerprints?.[0] || `${record.size}-${record.updatedAt}`;
        currentPage = startPage;
        updatePageControls();
        void extractRange();
      } catch (error) {
        setDocumentControls(false);
        setStatus(error?.message || "PDF 無法開啟，請確認檔案沒有損壞或密碼保護。", "error");
      }
    }

    async function saveSelectedFile(file) {
      if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
        setStatus("請選擇 PDF 檔案。", "error");
        return;
      }
      if (file.size > 120 * 1024 * 1024) {
        setStatus("PDF 超過 120 MB，為避免手機記憶體不足，請先壓縮檔案。", "error");
        return;
      }
      try {
        setStatus("正在安全地保存教材到這個瀏覽器…");
        const record = { templateId: options.templateId, blob: file, name: file.name, size: file.size, updatedAt: Date.now() };
        await putRecord(DOCUMENT_STORE, record);
        await openDocument(record);
      } catch {
        setStatus("無法保存 PDF，請確認瀏覽器儲存空間與隱私設定。", "error");
      }
    }

    chooseButton.addEventListener("click", () => fileInput.click());
    replaceButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => void saveSelectedFile(fileInput.files?.[0]));
    removeButton.addEventListener("click", async () => {
      if (!window.confirm("要移除這個瀏覽器內保存的教材 PDF 與課程文字嗎？學習進度不會受到影響。")) return;
      await deleteRecord(DOCUMENT_STORE, options.templateId);
      await deletePageText(`${options.templateId}:`);
      pdfDocument?.destroy();
      pdfDocument = undefined;
      textContent.replaceChildren();
      fileSummary.textContent = "尚未選擇教材";
      setDocumentControls(false);
      setStatus("本機教材與課程文字已移除。", "success");
      showView("text");
    });
    root.querySelectorAll("[data-reader-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.readerView)));
    previousButton.addEventListener("click", () => void renderPage(currentPage - 1));
    nextButton.addEventListener("click", () => void renderPage(currentPage + 1));
    pageInput.addEventListener("change", () => void renderPage(pageInput.value));

    setDocumentControls(false);
    showView("text");
    getRecord(DOCUMENT_STORE, options.templateId)
      .then((record) => record ? openDocument(record) : setStatus("第一次使用請選擇教材 PDF；之後會直接顯示這個任務的課程文字。"))
      .catch(() => setStatus("瀏覽器無法使用本機教材資料庫，請檢查隱私或儲存空間設定。", "error"));
  }

  window.LearningPdfReader = { mount };
})();
