// src/ui/job-uploader/job-uploader-renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        filePathDisplay: document.getElementById('file-path-display'),
        browseButton: document.getElementById('btn-browse'),
        startNowCheckbox: document.getElementById('cb-start-now'),
        autoLevelCheckbox: document.getElementById('cb-auto-level'),
        printerModel: document.getElementById('meta-printer'),
        filamentType: document.getElementById('meta-filament-type'),
        filamentLen: document.getElementById('meta-filament-len'),
        filamentWt: document.getElementById('meta-filament-wt'),
        supportUsed: document.getElementById('meta-support'),
        slicerName: document.getElementById('meta-slicer-name'),
        slicerVer: document.getElementById('meta-slicer-ver'),
        sliceDate: document.getElementById('meta-slice-date'),
        sliceTime: document.getElementById('meta-slice-time'),
        thumbnailBox: document.getElementById('meta-thumbnail'),
        eta: document.getElementById('meta-eta'),
        okButton: document.getElementById('btn-ok'),
        cancelButton: document.getElementById('btn-cancel'),
        closeButton: document.getElementById('btn-close'),
        loadingOverlay: document.getElementById('loading-overlay'),
    };

    let currentFilePath = null;

    // --- Event Listeners ---
    elements.browseButton.addEventListener('click', () => {
        resetMetadata(); // Clear previous metadata on new browse
        window.uploaderApi.browseFile();
    });

    elements.okButton.addEventListener('click', () => {
        if (currentFilePath) {
            const payload = {
                filePath: currentFilePath,
                startNow: elements.startNowCheckbox.checked,
                autoLevel: elements.autoLevelCheckbox.checked,
            };
            // Optionally show an "Uploading..." state here
            window.uploaderApi.uploadJob(payload);
        }
    });

    elements.cancelButton.addEventListener('click', () => {
        window.uploaderApi.cancelUpload();
    });

    elements.closeButton.addEventListener('click', () => {
        window.uploaderApi.cancelUpload();
    });

    // --- IPC Handlers ---
    window.uploaderApi.receiveFile((filePath) => {
        console.log('File selected:', filePath);
        if (filePath) {
            currentFilePath = filePath;
            // Display filename, not full path for brevity
            elements.filePathDisplay.textContent = filePath.split(/[\\/]/).pop() || filePath;
            elements.filePathDisplay.title = filePath; // Show full path on hover
            // OK button remains disabled until metadata is parsed
            elements.okButton.disabled = true;
            // Show loading overlay while main process parses
            showLoading(true);
        } else {
            // User cancelled browse dialog
            currentFilePath = null;
            elements.filePathDisplay.textContent = 'No file selected...';
            elements.filePathDisplay.title = '';
            resetMetadata();
            elements.okButton.disabled = true;
            showLoading(false);
        }
    });

    window.uploaderApi.receiveMetadata((result) => {
        console.log('Metadata received:', result);
        showLoading(false); // Hide loading overlay

        if (result && !result.error) {
            populateMetadata(result);
            elements.okButton.disabled = false; // Enable OK button on success
        } else {
            // Handle parsing error
            elements.filePathDisplay.textContent = `Error parsing file: ${result?.error || 'Unknown error'}`;
            resetMetadata();
            elements.okButton.disabled = true;
            currentFilePath = null; // Invalidate path if parsing failed
            // Optionally show an error message to the user
            alert(`Could not parse file metadata:\n${result?.error || 'Unknown error'}`);
        }
    });

    // --- Helper Functions ---
    function populateMetadata(data) {
        // GCode/Embedded GCode data
        elements.printerModel.textContent = data.file?.printerModel || data.threeMf?.printerModelId || '-';
        elements.filamentType.textContent = data.file?.filamentType || data.threeMf?.filaments?.[0]?.type || '-';
        elements.filamentLen.textContent = data.file?.filamentUsedMM ? `${data.file.filamentUsedMM.toFixed(2)} mm` : (data.threeMf?.filaments?.[0]?.usedM ? `${parseFloat(data.threeMf.filaments[0].usedM).toFixed(2)} mm` : '-');
        elements.filamentWt.textContent = data.file?.filamentUsedG ? `${data.file.filamentUsedG.toFixed(2)} g` : (data.threeMf?.filaments?.[0]?.usedG ? `${parseFloat(data.threeMf.filaments[0].usedG).toFixed(2)} g` : '-');
        elements.slicerName.textContent = data.slicer?.slicerName || '-';
        elements.slicerVer.textContent = data.slicer?.slicerVersion || '-';
        elements.sliceDate.textContent = data.slicer?.sliceDate || '-';
        elements.sliceTime.textContent = data.slicer?.sliceTime || '-';
        elements.eta.textContent = data.slicer?.printEta || '-';

        // 3MF specific data
        elements.supportUsed.textContent = data.threeMf ? (data.threeMf.supportUsed ? 'Yes' : 'No') : '-';

        // Thumbnail (Prefer 3MF plateImage, fallback to GCode thumbnail)
        const thumbnailData = data.threeMf?.plateImage || data.file?.thumbnail;
        if (thumbnailData) {
            // Check if it already has the data URL prefix
            const src = thumbnailData.startsWith('data:image') ? thumbnailData : `data:image/png;base64,${thumbnailData}`;
            elements.thumbnailBox.innerHTML = `<img src="${src}" alt="Preview" />`;
        } else {
            elements.thumbnailBox.innerHTML = '<span class="no-preview-text">No Preview</span>';
        }
    }

    function resetMetadata() {
        elements.printerModel.textContent = '-';
        elements.filamentType.textContent = '-';
        elements.filamentLen.textContent = '-';
        elements.filamentWt.textContent = '-';
        elements.supportUsed.textContent = '-';
        elements.slicerName.textContent = '-';
        elements.slicerVer.textContent = '-';
        elements.sliceDate.textContent = '-';
        elements.sliceTime.textContent = '-';
        elements.eta.textContent = '-';
        elements.thumbnailBox.innerHTML = '<span class="no-preview-text">No Preview</span>';
    }

    function showLoading(show) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    // --- Initial State ---
    resetMetadata(); // Clear fields initially
    elements.okButton.disabled = true; // OK disabled initially

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        window.uploaderApi.removeListeners();
    });
});