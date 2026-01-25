Place the Windows Tesseract build here before packaging:
- tesseract.exe
- tessdata/ (folder with language data)

This folder is bundled into the installer if present. The launcher will auto-set
TESSERACT_EXE and TESSDATA_PREFIX to this location when available.
