from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional
import sys # Neuer Import

from PyQt6.QtCore import Qt, QUrl, QSettings
from PyQt6.QtGui import QDesktopServices
from PyQt6.QtWidgets import (
    QApplication,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QProgressBar,
    QPlainTextEdit,
    QSizePolicy,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
    QFileDialog, QCheckBox,
)

from config import EndpointConfig, EndpointsFile, RateLimitSettings, ensure_output_dir, get_default_output_dir, load_endpoints
from workers import DownloadThread

logger = logging.getLogger(__name__)


def resource_path(relative: str) -> Path:
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / relative
    return Path(__file__).resolve().parent / relative


STYLE_SHEET = """
QMainWindow {
    background: qradialgradient(cx:0.5, cy:0, radius:1.2, fx:0.5, fy:0, stop:0 rgba(255,223,158,20), stop:0.45 transparent, stop:1 #0f1014);
}
QWidget {
    color: #fae6bc;
    font-family: 'Segoe UI', 'Noto Sans', sans-serif;
    font-size: 11pt;
}
QLineEdit, QPlainTextEdit, QListWidget, QTableWidget {
    background-color: #181a21;
    border: 1px solid #3f4046;
    border-radius: 10px;
    padding: 8px;
    selection-background-color: rgba(247,186,72,0.45);
    color: #fae6bc;
}
QTableWidget::item:selected, QListWidget::item:selected {
    background-color: rgba(247,186,72,0.35);
}
QCheckBox, QListWidget {
    spacing: 6px;
}
QCheckBox::indicator, QListView::indicator {
    width: 16px;
    height: 16px;
    border-radius: 5px;
    border: 1px solid #fbe5a0;
    background: #121318;
}
QCheckBox::indicator:hover, QListView::indicator:hover {
    border: 1px solid rgba(247,186,72,0.75);
    box-shadow: 0 0 0 2px rgba(247,186,72,0.15);
}
QCheckBox::indicator:checked, QListView::indicator:checked {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #f9d87a, stop:1 #e7ae41);
    border: 1px solid #fbe5a0;
    image: none;
}
QCheckBox::indicator:unchecked, QListView::indicator:unchecked {
    image: none;
}
QPushButton {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #f9d87a, stop:1 #e7ae41);
    border: 1px solid #fbe5a0;
    padding: 9px 16px;
    border-radius: 14px;
    font-weight: 600;
    color: #201506;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.32), 0 12px 28px rgba(0,0,0,0.4);
}
QPushButton:disabled {
    background: #121318;
    border: 1px solid #3f4046;
    color: #8f876b;
    box-shadow: none;
}
QPushButton:hover:!disabled {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #fbe08d, stop:1 #eab252);
    border-color: #fdebb5;
}
QProgressBar {
    background-color: #121318;
    border-radius: 10px;
    text-align: center;
    border: 1px solid #3f4046;
    height: 18px;
    color: #fae6bc;
}
QProgressBar::chunk {
    background-color: #9fcf7a;
    border-radius: 10px;
}
QSplitter::handle {
    background: #181a21;
}
QLabel {
    color: #d8c489;
}
QListWidget, QTableWidget, QPlainTextEdit {
    alternate-background-color: #121318;
}
"""


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Flyff API Downloader")
        self.setMinimumSize(1100, 720)
        self.setStyleSheet(STYLE_SHEET)
        self.worker: Optional[DownloadThread] = None
        self.settings = QSettings("FlyffU", "FlyffAPIDownloader")

        self.downloaded_count = 0
        self.endpoints_path = resource_path("endpoints.json")
        self.endpoints_file: Optional[EndpointsFile] = None
        self.rate_limit = RateLimitSettings()
        self.base_url = ""

        self.output_dir = ensure_output_dir(get_default_output_dir())

        self._build_ui()
        self._load_endpoints()

    # UI construction -----------------------------------------------------
    def _build_ui(self) -> None:
        container = QWidget()
        main_layout = QVBoxLayout(container)

        # =========================
        # Output path row
        # =========================
        path_layout = QHBoxLayout()
        path_layout.addWidget(QLabel("Output:"))

        self.output_display = QLineEdit(str(self.output_dir))
        self.output_display.setReadOnly(True)
        path_layout.addWidget(self.output_display, stretch=1)

        self.change_output_btn = QPushButton("Pfad ändern")
        self.change_output_btn.clicked.connect(self._choose_output_dir)
        path_layout.addWidget(self.change_output_btn)

        self.open_output_btn = QPushButton("Ordner öffnen")
        self.open_output_btn.clicked.connect(self._open_output_folder)
        path_layout.addWidget(self.open_output_btn)

        self.reload_btn = QPushButton("Konfig neu laden")
        self.reload_btn.clicked.connect(self._load_endpoints)
        path_layout.addWidget(self.reload_btn)

        main_layout.addLayout(path_layout)

        # =========================
        # Controls row
        # =========================
        controls_layout = QHBoxLayout()

        self.start_btn = QPushButton("Start")
        self.start_btn.clicked.connect(self.start_downloads)
        controls_layout.addWidget(self.start_btn)

        self.pause_btn = QPushButton("Pause")
        self.pause_btn.setEnabled(False)
        self.pause_btn.clicked.connect(self._toggle_pause)
        controls_layout.addWidget(self.pause_btn)

        self.cancel_btn = QPushButton("Abbrechen")
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self._cancel_worker)
        controls_layout.addWidget(self.cancel_btn)

        self.requests_label = QLabel(
            f"Requests (Fenster): 0 / {self.rate_limit.max_requests} | Total: 0"
        )
        controls_layout.addWidget(self.requests_label)

        controls_layout.addStretch()
        main_layout.addLayout(controls_layout)

        # =========================
        # Progress
        # =========================
        self.progress = QProgressBar()
        self.progress.setRange(0, 100)
        main_layout.addWidget(self.progress)

        # =========================
        # Splitter
        # =========================
        splitter = QSplitter()

        # -------------------------
        # Left pane: endpoints
        # -------------------------
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)

        # Filter
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(QLabel("Filter:"))

        self.filter_edit = QLineEdit()
        self.filter_edit.setPlaceholderText("Endpunkte filtern...")
        self.filter_edit.textChanged.connect(self._apply_filter)
        filter_layout.addWidget(self.filter_edit)

        left_layout.addLayout(filter_layout)

        # Select all checkbox
        self.select_all_cb = QCheckBox("Alle Endpunkte auswählen")
        self.select_all_cb.clicked.connect(self._toggle_all_endpoints)
        left_layout.addWidget(self.select_all_cb)

        # Endpoint list
        self.endpoint_list = QListWidget()
        self.endpoint_list.setSelectionMode(QListWidget.SelectionMode.NoSelection)
        self.endpoint_list.itemChanged.connect(self._on_endpoint_checked)
        left_layout.addWidget(self.endpoint_list)

        splitter.addWidget(left_widget)

        # -------------------------
        # Right pane: status / log
        # -------------------------
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)

        status_grid = QGridLayout()
        status_grid.addWidget(QLabel("Aktueller Endpunkt:"), 0, 0)
        self.current_endpoint_label = QLabel("-")
        status_grid.addWidget(self.current_endpoint_label, 0, 1)

        status_grid.addWidget(QLabel("Verbleibend (Schritte):"), 1, 0)
        self.remaining_label = QLabel("-")
        status_grid.addWidget(self.remaining_label, 1, 1)

        status_grid.addWidget(QLabel("Bereits geladen:"), 2, 0)
        self.downloaded_label = QLabel("0")
        status_grid.addWidget(self.downloaded_label, 2, 1)

        right_layout.addLayout(status_grid)

        # Status table
        self.status_table = QTableWidget(0, 3)
        self.status_table.setHorizontalHeaderLabels(
            ["Endpoint", "Status", "Datei"]
        )
        self.status_table.horizontalHeader().setStretchLastSection(True)
        self.status_table.setSizePolicy(
            QSizePolicy.Policy.Expanding,
            QSizePolicy.Policy.Expanding,
        )
        right_layout.addWidget(self.status_table)

        # Error list
        right_layout.addWidget(QLabel("Fehler"))
        self.error_list = QListWidget()
        self.error_list.setMinimumHeight(80)
        right_layout.addWidget(self.error_list)

        # Log output
        right_layout.addWidget(QLabel("Log"))
        self.log_output = QPlainTextEdit()
        self.log_output.setReadOnly(True)
        self.log_output.setPlaceholderText("Log-Ausgabe...")
        right_layout.addWidget(self.log_output)

        splitter.addWidget(right_widget)
        splitter.setStretchFactor(1, 2)

        main_layout.addWidget(splitter)

        self.setCentralWidget(container)

    # Loading endpoints ---------------------------------------------------
    def _load_endpoints(self) -> None:
        try:
            endpoints_file = load_endpoints(self.endpoints_path)
            self.endpoints_file = endpoints_file
            self.base_url = endpoints_file.base_url
            self._populate_endpoint_list(endpoints_file.endpoints)
            self._append_log(f"Konfiguration geladen: {self.endpoints_path}")
        except Exception as exc:  # noqa: BLE001
            self.endpoints_file = None
            self.base_url = ""
            self.endpoint_list.clear()
            QMessageBox.critical(self, "Fehler", f"Konnte Endpunkte nicht laden: {exc}")

    def _populate_endpoint_list(self, endpoints: List[EndpointConfig]) -> None:
        self.endpoint_list.blockSignals(True)
        self.endpoint_list.clear()
        self.status_table.setRowCount(0)
        for ep in endpoints:
            item = QListWidgetItem(ep.name)
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            stored = self.settings.value(self._settings_key(ep), type=bool)
            is_enabled = stored if stored is not None else ep.enabled
            item.setCheckState(Qt.CheckState.Checked if is_enabled else Qt.CheckState.Unchecked)
            item.setData(Qt.ItemDataRole.UserRole, ep)
            self.endpoint_list.addItem(item)

            row = self.status_table.rowCount()
            self.status_table.insertRow(row)
            self.status_table.setItem(row, 0, QTableWidgetItem(ep.name))
            self.status_table.setItem(row, 1, QTableWidgetItem("Bereit"))
            self.status_table.setItem(row, 2, QTableWidgetItem(""))
        self.endpoint_list.blockSignals(False)
        self._update_select_all_checkbox()

    # UI Helpers ---------------------------------------------------------
    def _apply_filter(self, text: str) -> None:
        text_lower = text.lower()
        for i in range(self.endpoint_list.count()):
            item = self.endpoint_list.item(i)
            visible = text_lower in item.text().lower()
            item.setHidden(not visible)

    def _choose_output_dir(self) -> None:
        path = QFileDialog.getExistingDirectory(self, "Output-Pfad wählen", str(self.output_dir))
        if path:
            self.output_dir = ensure_output_dir(Path(path))
            self.output_display.setText(str(self.output_dir))

    def _open_output_folder(self) -> None:
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(self.output_dir)))

    def _set_running_state(self, running: bool) -> None:
        self.start_btn.setEnabled(not running)
        self.pause_btn.setEnabled(running)
        self.cancel_btn.setEnabled(running)
        if not running:
            self.pause_btn.setText("Pause")

    # Worker lifecycle ---------------------------------------------------
    def start_downloads(self) -> None:
        if not self.endpoints_file:
            QMessageBox.warning(self, "Fehlende Konfiguration", "Bitte endpoints.json bereitstellen.")
            return

        selected = self._selected_endpoints()
        if not selected:
            QMessageBox.information(self, "Keine Endpunkte", "Bitte mindestens einen Endpunkt auswählen.")
            return

        self._set_running_state(True)
        self.progress.setValue(0)
        self.error_list.clear()
        self.log_output.clear()
        self.downloaded_count = 0
        self.downloaded_label.setText("0")
        self.remaining_label.setText("-")
        self.requests_label.setText(f"Requests (Fenster): 0 / {self.rate_limit.max_requests} | Total: 0")
        for row in range(self.status_table.rowCount()):
            self.status_table.item(row, 1).setText("Bereit")
            self.status_table.item(row, 2).setText("")

        self.worker = DownloadThread(self.base_url, selected, self.output_dir, rate_limit=self.rate_limit)
        self.worker.progress_changed.connect(self._on_progress)
        self.worker.endpoint_started.connect(self._on_endpoint_started)
        self.worker.endpoint_finished.connect(self._on_endpoint_finished)
        self.worker.log_message.connect(self._append_log)
        self.worker.request_window.connect(self._on_request_window)
        self.worker.finished_all.connect(self._on_finished_all)
        self.worker.cancelled.connect(self._on_cancelled)
        self.worker.start()

    def _cancel_worker(self) -> None:
        if self.worker:
            self.worker.cancel()

    def _toggle_pause(self) -> None:
        if not self.worker:
            return
        if self.worker.isRunning():
            if not self.worker.is_paused():
                self.worker.pause()
                self.pause_btn.setText("Fortsetzen")
            else:
                self.worker.resume()
                self.pause_btn.setText("Pause")

    # Worker signal handlers ---------------------------------------------
    def _on_progress(self, completed: int, total: int) -> None:
        percent = int((completed / total) * 100) if total else 0
        self.progress.setValue(percent)
        remaining = max(total - completed, 0)
        self.remaining_label.setText(str(remaining))

    def _on_endpoint_started(self, name: str, idx: int, total: int) -> None:
        self.current_endpoint_label.setText(f"{name} ({idx}/{total})")
        self._append_log(f"Starte {name}")

    def _on_endpoint_finished(self, name: str, success: bool, path: str, error: str) -> None:
        status_text = "OK" if success else "Fehler"
        for row in range(self.status_table.rowCount()):
            if self.status_table.item(row, 0).text() == name:
                self.status_table.item(row, 1).setText(status_text)
                self.status_table.item(row, 1).setForeground(Qt.GlobalColor.green if success else Qt.GlobalColor.red)
                self.status_table.item(row, 2).setText(path)
                break
        if success:
            self.downloaded_count += 1
            self.downloaded_label.setText(str(self.downloaded_count))
            self._append_log(f"Fertig: {name} -> {path}")
        else:
            self.error_list.addItem(f"{name}: {error}")
            self._append_log(f"Fehler: {name} -> {error}")

    def _on_request_window(self, used: int, max_requests: int, total: int) -> None:
        self.requests_label.setText(f"Requests (Fenster): {used} / {max_requests} | Total: {total}")

    def _on_finished_all(self, successes: int, failures: int, duration: float, manifest_path: str) -> None:
        self._append_log(f"Downloads abgeschlossen. Erfolgreich: {successes}, Fehler: {failures}, Dauer: {duration:.1f}s")
        if manifest_path:
            self._append_log(f"Manifest: {manifest_path}")
        QMessageBox.information(self, "Fertig", "Downloads abgeschlossen.")
        self.worker = None
        self._set_running_state(False)

    def _on_cancelled(self) -> None:
        self._append_log("Abgebrochen.")
        QMessageBox.information(self, "Abgebrochen", "Downloads wurden abgebrochen.")
        self.worker = None
        self._set_running_state(False)

    def _toggle_all_endpoints(self, checked: bool) -> None:
        check_state = Qt.CheckState.Checked if checked else Qt.CheckState.Unchecked

        self.endpoint_list.blockSignals(True)
        for i in range(self.endpoint_list.count()):
            item = self.endpoint_list.item(i)
            if item.flags() & Qt.ItemFlag.ItemIsUserCheckable:
                item.setCheckState(check_state)
        self.endpoint_list.blockSignals(False)

        # wichtig: Status danach synchronisieren
        self._update_select_all_checkbox()

    # Utilities -----------------------------------------------------------
    def _append_log(self, message: str) -> None:
        self.log_output.appendPlainText(message)
        self.log_output.verticalScrollBar().setValue(self.log_output.verticalScrollBar().maximum())

    def _selected_endpoints(self) -> List[EndpointConfig]:
        items = []
        for i in range(self.endpoint_list.count()):
            item = self.endpoint_list.item(i)
            if item.checkState() == Qt.CheckState.Checked:
                ep: EndpointConfig = item.data(Qt.ItemDataRole.UserRole)
                items.append(ep)
        return items

    def _settings_key(self, ep: EndpointConfig) -> str:
        return f"endpoint/{ep.name or ep.path}"

    def _on_endpoint_checked(self, item: QListWidgetItem) -> None:
        self._update_select_all_checkbox()
        ep: EndpointConfig = item.data(Qt.ItemDataRole.UserRole)
        checked = item.checkState() == Qt.CheckState.Checked
        self.settings.setValue(self._settings_key(ep), checked)

    def _update_select_all_checkbox(self) -> None:
        checked = 0
        total = 0

        for i in range(self.endpoint_list.count()):
            item = self.endpoint_list.item(i)
            if not (item.flags() & Qt.ItemFlag.ItemIsUserCheckable):
                continue
            total += 1
            if item.checkState() == Qt.CheckState.Checked:
                checked += 1

        self.select_all_cb.blockSignals(True)
        self.select_all_cb.setCheckState(
            Qt.CheckState.Checked if total > 0 and checked == total else Qt.CheckState.Unchecked
        )
        self.select_all_cb.blockSignals(False)



