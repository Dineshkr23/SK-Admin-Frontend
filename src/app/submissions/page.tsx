"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  Stack,
  InputLabel,
  FormControl,
  Select,
  MenuItem,
  Popover,
  Skeleton,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FilterListIcon from "@mui/icons-material/FilterList";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PrintIcon from "@mui/icons-material/Print";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { DataGrid, GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import {
  fetchFilterOptions,
  fetchSubmissions,
  fetchSubmissionById,
  bulkUpdateSubmissions,
  updateSubmission,
  exportSubmissionsExcel,
  fetchGlobalPrice,
  updateGlobalPrice,
  type TableRecord,
  type SubmissionDetail,
} from "@/lib/api";
import { getUserRole } from "@/lib/auth";
import {
  adminColors,
  adminSectionHeaderBarStyle,
  adminGridTwo,
  dialogInputSx,
} from "@/styles/adminTheme";

const PROFESSION_DROPDOWN_OPTIONS = [
  { label: "All professions", value: "" },
  // Use canonical backend `formType` values for robust filtering.
  { label: "Individual House Builder", value: "individual" },
  { label: "Commercial House Builder", value: "commercial" },
  { label: "Architect & Engineer", value: "architectEngineer" },
  { label: "SK Super TMT Dealership", value: "dealer" },
  { label: "Mason & BarBender", value: "masonBarBender" },
] as const;

const STATUS_DROPDOWN_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
] as const;

const STATES = [
  "Karnataka",
  "Tamil Nadu",
  "Kerala",
  "Andhra Pradesh",
  "Maharashtra",
  "Other",
];

/** Prefer base64 (legacy) over path; returns data URL or URL string for img src. */
function getImageSrc(
  path: string | null | undefined,
  base64: string | null | undefined,
): string | undefined {
  if (base64 != null && String(base64).trim()) {
    const s = String(base64).trim();
    return s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}`;
  }
  if (path != null && String(path).trim()) return String(path).trim();
  return undefined;
}

function toDateInputValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v !== "string") {
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return "";
  }

  const s = v.trim();
  if (!s) return "";

  // Fast path: already in YYYY-MM-DD or ISO prefix.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateToDMY(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "—";
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const dt = new Date(s);
      if (!Number.isNaN(dt.getTime())) {
        const d = String(dt.getDate()).padStart(2, "0");
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const y = dt.getFullYear();
        return `${d}-${m}-${y}`;
      }
    }
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      const d = String(dt.getDate()).padStart(2, "0");
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const y = dt.getFullYear();
      return `${d}-${m}-${y}`;
    }
    return s;
  }
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "—";
    const d = String(v.getDate()).padStart(2, "0");
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const y = v.getFullYear();
    return `${d}-${m}-${y}`;
  }
  return "—";
}

function toUpperText(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).trim();
  if (!s) return "—";
  return s.toUpperCase();
}

type EditableDetail = Record<
  string,
  string | number | boolean | null | undefined
>;

function toEditable(d: SubmissionDetail | null): EditableDetail {
  if (!d) return {};
  const out: EditableDetail = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === null || v === undefined) out[k] = "";
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" || typeof v === "number") out[k] = v;
    else if (v instanceof Date) out[k] = v as unknown as string;
    else out[k] = String(v);
  }
  return out;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPassportHtml(f: EditableDetail): string {
  const name = toUpperText(
    `${f.pi_firstName ?? ""} ${f.pi_lastName ?? ""}`.trim(),
  );
  const addr1 = toUpperText(f.pi_addressLane1 ?? "—");
  const addr2 = toUpperText(f.pi_addressLane2 ?? "");
  const pincode = toUpperText(f.pi_pincode ?? "—");
  const city = toUpperText(f.pi_city ?? "—");
  const state = toUpperText(f.pi_state ?? "—");
  const landmark = toUpperText(f.pi_landmark ?? "—");
  const phone = toUpperText(f.pi_phone ?? "—");
  const dob = toUpperText(formatDateToDMY(f.pi_dob));
  const opArea = toUpperText(f.pi_city ?? "—");
  const regBy = toUpperText(f.ref_nameOfTheperson ?? "—");
  const passportNo = f.skPassportNo ?? "—";
  const photoSrc =
    getImageSrc(f.photoProofPath as string, f.photoProofData as string) ?? "";

  const rulerRow = (content: string) => `
    <div style="border-bottom:2px solid #0b0b0b;padding-bottom:5.2px;margin-bottom:4.8px">
      <div style="font-weight:400">${content}</div>
    </div>`;

  const chevrons = "&lt;".repeat(27);

  return `
  <div style="width:700px;max-width:100%;margin:0 auto;background-color:#D6F4FA;border:none;padding:12px;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;page-break-inside:avoid">
    <div style="font-weight:400;font-size:18px;text-align:center;border-bottom:2px solid #0b0b0b;padding-bottom:6.4px;margin-bottom:4px;line-height:1.1">
      SK SUPER TMT PASSPORT TO PROGRESS
    </div>
    <div style="font-weight:800;font-size:16px;text-align:right;padding-right:8px">
      Passport No. ${escHtml(String(passportNo))}
    </div>
    <div style="margin-top:8px;display:grid;grid-template-columns:210px 1fr;gap:8px">
      <img src="${escHtml(photoSrc)}" alt="Photograph" style="width:200px;height:230px;object-fit:cover;border:1px solid rgba(0,0,0,0.15);background-color:#ffffff" />
      <div style="font-size:14px;line-height:1.35">
        ${rulerRow(`Name: ${escHtml(name)}`)}
        ${rulerRow(escHtml(addr1))}
        ${rulerRow(escHtml(addr2))}
        ${rulerRow(`Pincode: ${escHtml(pincode)} <span>City: ${escHtml(city)}</span> <span style="margin-left:8px">State: ${escHtml(state)}</span>`)}
        ${rulerRow(`Landmark: ${escHtml(landmark)}`)}
        ${rulerRow(`Mobile Number: ${escHtml(phone)} <span style="margin-left:8px">DOB: ${escHtml(dob)}</span>`)}
        <div style="margin-top:4.8px;display:flex;justify-content:space-between;gap:16px">
          <div style="font-size:13px;font-weight:400">Operational Area: ${escHtml(opArea)}</div>
          <div style="font-size:13px;font-weight:400">Reg. By: ${escHtml(regBy)}</div>
        </div>
      </div>
    </div>
    <div style="margin-top:9.6px;font-weight:900;font-family:monospace;font-size:16px;text-align:center">
      <div style="white-space:pre;font-size:18px;letter-spacing:2px;font-weight:900">${chevrons}</div>
      <div style="white-space:pre;font-size:18px;letter-spacing:2px;font-weight:900">${chevrons}</div>
    </div>
  </div>`;
}

function buildUpdatePayload(form: EditableDetail): Partial<SubmissionDetail> {
  const payload: Record<string, unknown> = {};
  const keys = [
    "title",
    "age",
    "sameAsAbove",
    "remarks",
    "validationCode",
    "pi_firstName",
    "pi_lastName",
    "pi_profession",
    "pi_dob",
    "pi_phone",
    "pi_whatsAppNumber",
    "pi_emailId",
    "pi_addressLane1",
    "pi_addressLane2",
    "pi_taluk",
    "pi_district",
    "pi_city",
    "pi_state",
    "pi_pincode",
    "pi_landmark",
    "pi_anniversaryDate",
    "ref_nameOfTheperson",
    "ref_place",
    "reporting_manager_name",
    "sod_nameOfTheDealer",
    "sod_place",
    "shop_location",
    "shop_Address1",
    "shop_Address2",
    "shop_District",
    "shop_Taluk",
    "shop_City",
    "shop_Pincode",
    "shop_Landmark",
    "dealershipName",
    "contactPerson",
    "gstNumber",
    "panNumber",
    "ownerSameAsAbove",
    "ownerTitle",
    "ownerFirstName",
    "ownerLastName",
    "ownerOfficeAddressLine1",
    "ownerOfficeAddressLine2",
    "ownerCity",
    "ownerState",
    "ownerPostalCode",
    "ownerPlace",
    "ownerPhoneNumber",
    "ownerEmailId",
    "secondContactTitle",
    "secondContactFirstName",
    "secondContactLastName",
    "secondContactPhone",
    "secondContactEmail",
    "spouseName",
    "spouseDob",
    "weddingDay",
    "childName1",
    "childDob1",
    "childName2",
    "childDob2",
    "childName3",
    "childDob3",
    "godownSameAsCompany",
    "godownAddressLine1",
    "godownAddressLine2",
    "godownCity",
    "godownState",
    "godownPostalCode",
    "godownContactPerson",
    "godownContactMobile",
    "referenceName1",
    "referencePhone1",
    "referenceDetails1",
    "referenceName2",
    "referencePhone2",
    "referenceDetails2",
    "enteredBy",
    "isContacted",
    "isApproved",
    "isDeleted",
    "isActive",
    "isPending",
    "isRejected",
  ];
  const booleanKeys = [
    "sameAsAbove",
    "ownerSameAsAbove",
    "godownSameAsCompany",
  ];
  for (const k of keys) {
    const v = form[k];
    if (v === undefined) continue;
    if (k.startsWith("is") || booleanKeys.includes(k)) {
      payload[k] = v === true || v === "true";
    } else {
      payload[k] = v === "" ? undefined : v;
    }
  }
  return payload as Partial<SubmissionDetail>;
}

const FORM_TYPES = [
  "masonBarBender",
  "architectEngineer",
  "commercial",
  "individual",
  "dealer",
] as const;
type DialogFormType = (typeof FORM_TYPES)[number];

/** Resolve dialog form type from submission: formType if present, else infer from pi_profession. */
function getDialogFormType(form: EditableDetail): DialogFormType {
  const raw = form.formType ?? form.form_type;
  if (
    typeof raw === "string" &&
    (FORM_TYPES as readonly string[]).includes(raw)
  ) {
    return raw as DialogFormType;
  }
  const profession = String(form.pi_profession ?? "").trim();
  if (["Mason", "BarBender"].includes(profession)) return "masonBarBender";
  if (["Architect", "Engineer"].includes(profession))
    return "architectEngineer";
  if (profession === "Commercial") return "commercial";
  if (profession === "Individual") return "individual";
  if (
    [
      "Proprietor",
      "Partner",
      "Proprietor Ship",
      "Partnership",
      "Private Limited",
    ].some((p) => profession.includes(p))
  )
    return "dealer";
  return "masonBarBender";
}

function DialogSectionHeader({ title }: { title: string }) {
  return (
    <Typography component="div" sx={adminSectionHeaderBarStyle}>
      {title}
    </Typography>
  );
}

const dialogGridSx = {
  ...adminGridTwo,
  "& .MuiTextField-root": dialogInputSx,
  "& .MuiFormControl-root": dialogInputSx,
} as const;

export default function SubmissionsPage() {
  const userRole = getUserRole();
  const isPriceEditor = userRole === "PRICE_EDITOR";
  const canExportExcel = userRole === "ADMIN";
  const canUpdatePrice = userRole === "ADMIN" || userRole === "PRICE_EDITOR";

  const [rows, setRows] = useState<TableRecord[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [professionFilter, setProfessionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [salesOfficerOptions, setSalesOfficerOptions] = useState<string[]>([]);
  const [reportingManagerOptions, setReportingManagerOptions] = useState<
    string[]
  >([]);
  const [salesOfficerSelected, setSalesOfficerSelected] = useState<string[]>(
    [],
  );
  const [reportingManagerSelected, setReportingManagerSelected] = useState<
    string[]
  >([]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState<EditableDetail>({});
  const didAutoScrollPassportRef = useRef(false);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const [photoProofFile, setPhotoProofFile] = useState<File | null>(null);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [idProofBackFile, setIdProofBackFile] = useState<File | null>(null);
  const [panProofFile, setPanProofFile] = useState<File | null>(null);
  const [clearedPhotoProof, setClearedPhotoProof] = useState(false);
  const [clearedIdProof, setClearedIdProof] = useState(false);
  const [clearedIdProofBack, setClearedIdProofBack] = useState(false);
  const [clearedPanProof, setClearedPanProof] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingEnteredBy, setPendingEnteredBy] = useState<
    Record<string, string>
  >({});
  const [pendingEnteredDate, setPendingEnteredDate] = useState<
    Record<string, string>
  >({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [rowSelectionModel, setRowSelectionModel] =
    useState<GridRowSelectionModel>({ type: "include", ids: new Set() });
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false);
  const [deletedDialogOpen, setDeletedDialogOpen] = useState(false);
  const [deletedRows, setDeletedRows] = useState<TableRecord[]>([]);
  const [deletedRecordCount, setDeletedRecordCount] = useState(0);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedPage, setDeletedPage] = useState(0);
  const [deletedPageSize, setDeletedPageSize] = useState(20);
  const [imageGalleryOpen, setImageGalleryOpen] = useState(false);
  const [filtersPopoverAnchorEl, setFiltersPopoverAnchorEl] =
    useState<HTMLElement | null>(null);

  const filtersPopoverOpen = Boolean(filtersPopoverAnchorEl);
  const handleOpenFilters = (e: MouseEvent<HTMLElement>) =>
    setFiltersPopoverAnchorEl(e.currentTarget);
  const handleCloseFilters = () => setFiltersPopoverAnchorEl(null);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportFormType, setExportFormType] = useState("");
  const [exportSalesOfficer, setExportSalesOfficer] = useState<string[]>([]);
  const [exportReportingManager, setExportReportingManager] = useState<
    string[]
  >([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [priceValue, setPriceValue] = useState<string>("");
  const [priceUpdating, setPriceUpdating] = useState(false);
  const [priceDialogError, setPriceDialogError] = useState<string | null>(null);

  const openUpdatePriceDialog = async () => {
    setPriceDialogError(null);
    setPriceDialogOpen(true);
    setPriceUpdating(true);
    try {
      const { price } = await fetchGlobalPrice();
      setPriceValue(String(price ?? 0));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load price";
      setPriceDialogError(msg);
    } finally {
      setPriceUpdating(false);
    }
  };

  const handleUpdatePrice = async () => {
    setPriceDialogError(null);

    const n = Number(priceValue);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      setPriceDialogError("Please enter a valid non-negative integer price.");
      return;
    }

    setPriceUpdating(true);
    try {
      await updateGlobalPrice(n);
      setPriceDialogOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to update price. Try again.";
      setPriceDialogError(msg);
    } finally {
      setPriceUpdating(false);
    }
  };

  const openExportDialog = () => {
    setExportFrom(dateFrom);
    setExportTo(dateTo);
    setExportFormType("");
    setExportSalesOfficer([]);
    setExportReportingManager([]);
    setExportError(null);
    setExportDialogOpen(true);
  };

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      setExportError(null);

      const { blob, filename } = await exportSubmissionsExcel({
        dateFrom: exportFrom || undefined,
        dateTo: exportTo || undefined,
        formTypes: exportFormType || undefined,
        salesOfficer:
          exportSalesOfficer.length > 0
            ? exportSalesOfficer.join(",")
            : undefined,
        reportingManager:
          exportReportingManager.length > 0
            ? exportReportingManager.join(",")
            : undefined,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to export Excel";
      console.error(err);
      setExportError(msg);
    } finally {
      setExportLoading(false);
    }
  };
  const [imageGalleryImages, setImageGalleryImages] = useState<
    Array<{ src: string; label: string }>
  >([]);
  const [imageGalleryIndex, setImageGalleryIndex] = useState(0);

  const openImageGallery = useCallback(
    (images: Array<{ src: string; label: string }>, initialIndex: number) => {
      setImageGalleryImages(images);
      setImageGalleryIndex(initialIndex);
      setImageGalleryOpen(true);
    },
    [],
  );

  const getFormImages = useCallback(() => {
    const images: Array<{ src: string; label: string }> = [];
    if (
      !clearedPhotoProof &&
      !photoProofFile &&
      getImageSrc(form.photoProofPath as string, form.photoProofData as string)
    ) {
      const src = getImageSrc(
        form.photoProofPath as string,
        form.photoProofData as string,
      )!;
      images.push({ src, label: "Photograph" });
    }
    if (
      !clearedIdProof &&
      !idProofFile &&
      getImageSrc(form.idProofPath as string, form.idProofData as string)
    ) {
      const src = getImageSrc(
        form.idProofPath as string,
        form.idProofData as string,
      )!;
      images.push({ src, label: "ID Proof" });
    }
    if (
      !clearedIdProofBack &&
      !idProofBackFile &&
      getImageSrc(
        form.idProofBackPath as string,
        form.idProofBackData as string,
      )
    ) {
      const src = getImageSrc(
        form.idProofBackPath as string,
        form.idProofBackData as string,
      )!;
      images.push({ src, label: "Address Proof - Back Side" });
    }
    if (
      getDialogFormType(form) === "dealer" &&
      !clearedPanProof &&
      !panProofFile &&
      getImageSrc(form.panProofPath as string, form.panProofData as string)
    ) {
      const src = getImageSrc(
        form.panProofPath as string,
        form.panProofData as string,
      )!;
      images.push({ src, label: "PAN Card Copy" });
    }
    return images;
  }, [
    form,
    clearedPhotoProof,
    clearedIdProof,
    clearedIdProofBack,
    clearedPanProof,
    photoProofFile,
    idProofFile,
    idProofBackFile,
    panProofFile,
  ]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (userRole === "PRICE_EDITOR") return;
    let cancelled = false;
    Promise.all([
      fetchFilterOptions("salesOfficer"),
      fetchFilterOptions("reportingManager"),
    ])
      .then(([so, rm]) => {
        if (cancelled) return;
        setSalesOfficerOptions(so.options ?? []);
        setReportingManagerOptions(rm.options ?? []);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [userRole]);

  const load = useCallback(async () => {
    setLoading(true);
    const formTypes = professionFilter
      ? professionFilter
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const isApproved =
      statusFilter === "approved" ? true : statusFilter ? undefined : undefined;
    const isRejected =
      statusFilter === "rejected" ? true : statusFilter ? undefined : undefined;
    const isPending =
      statusFilter === "pending" ? true : statusFilter ? undefined : undefined;
    const isActive =
      statusFilter === "active" ? true : statusFilter ? undefined : undefined;
    try {
      const res = await fetchSubmissions({
        page: page + 1,
        limit: pageSize,
        search: searchDebounced || undefined,
        formTypes: formTypes.length > 0 ? formTypes.join(",") : undefined,
        isApproved,
        isDeleted: false,
        isActive,
        isPending,
        isRejected,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        salesOfficer:
          salesOfficerSelected.length > 0
            ? salesOfficerSelected.join(",")
            : undefined,
        reportingManager:
          reportingManagerSelected.length > 0
            ? reportingManagerSelected.join(",")
            : undefined,
      });
      setRows(res.records);
      setRecordCount(res.recordCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    searchDebounced,
    professionFilter,
    statusFilter,
    dateFrom,
    dateTo,
    salesOfficerSelected,
    reportingManagerSelected,
  ]);

  useEffect(() => {
    if (userRole === "PRICE_EDITOR") return;
    load();
  }, [load, userRole]);

  const loadDeleted = useCallback(async () => {
    if (!deletedDialogOpen) return;
    setDeletedLoading(true);
    try {
      const res = await fetchSubmissions({
        page: deletedPage + 1,
        limit: deletedPageSize,
        isDeleted: true,
      });
      setDeletedRows(res.records);
      setDeletedRecordCount(res.recordCount);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletedLoading(false);
    }
  }, [deletedDialogOpen, deletedPage, deletedPageSize]);

  useEffect(() => {
    loadDeleted();
  }, [loadDeleted]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setForm({});
      setPhotoProofFile(null);
      setIdProofFile(null);
      setIdProofBackFile(null);
      setPanProofFile(null);
      setClearedPhotoProof(false);
      setClearedIdProof(false);
      setClearedIdProofBack(false);
      setClearedPanProof(false);
      setSaveError(null);
      didAutoScrollPassportRef.current = false;
      return;
    }
    didAutoScrollPassportRef.current = false;
    setDetailLoading(true);
    fetchSubmissionById(detailId)
      .then((d) => {
        setDetail(d);
        setForm(toEditable(d));
        setPhotoProofFile(null);
        setIdProofFile(null);
        setIdProofBackFile(null);
        setClearedPhotoProof(false);
        setClearedIdProof(false);
        setClearedIdProofBack(false);
      })
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [detailId]);

  useEffect(() => {
    if (!detailId) return;
    if (detailLoading) return;
    if (didAutoScrollPassportRef.current) return;

    const targetId = "passport-to-progress-print";
    didAutoScrollPassportRef.current = true;

    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(targetId);
      const container = dialogContentRef.current;
      if (el && container) {
        // Scroll the dialog content container to make the target fully visible.
        const cRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const delta = elRect.top - cRect.top;
        container.scrollTo({
          top: container.scrollTop + delta,
          behavior: "auto",
        });
        return;
      }

      attempts += 1;
      if (attempts < 20) {
        setTimeout(tryScroll, 50);
      }
    };

    tryScroll();
  }, [detailId, detailLoading]);

  const setField = (key: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!detailId) return;
    setSaveLoading(true);
    setSaveError(null);
    try {
      const payload = {
        ...buildUpdatePayload(form),
        ...(clearedPhotoProof && { photoProofPath: null }),
        ...(clearedIdProof && { idProofPath: null }),
        ...(clearedIdProofBack && { idProofBackPath: null }),
        ...(clearedPanProof && { panProofPath: null }),
      };
      const updated = await updateSubmission(detailId, payload, {
        ...(photoProofFile && { photoProof: photoProofFile }),
        ...(idProofFile && { idProof: idProofFile }),
        ...(idProofBackFile && { idProofBack: idProofBackFile }),
        ...(panProofFile && { panProof: panProofFile }),
      });
      setDetail(updated);
      setForm(toEditable(updated));
      setPhotoProofFile(null);
      setIdProofFile(null);
      setIdProofBackFile(null);
      setPanProofFile(null);
      setClearedPhotoProof(false);
      setClearedIdProof(false);
      setClearedIdProofBack(false);
      setClearedPanProof(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleClearPanProof = () => {
    setPanProofFile(null);
    setClearedPanProof(true);
  };

  const handleClearPhotoProof = () => {
    setPhotoProofFile(null);
    setClearedPhotoProof(true);
  };
  const handleClearIdProof = () => {
    setIdProofFile(null);
    setClearedIdProof(true);
  };
  const handleClearIdProofBack = () => {
    setIdProofBackFile(null);
    setClearedIdProofBack(true);
  };

  const saveRowField = async (
    id: string,
    payload: Partial<SubmissionDetail>,
  ) => {
    setSavingRowId(id);
    try {
      await updateSubmission(id, payload);
      setPendingEnteredBy((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setPendingEnteredDate((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const p = payload as Record<string, unknown>;
          return {
            ...r,
            ...(p.enteredBy !== undefined
              ? { enteredBy: p.enteredBy as string | null }
              : {}),
            ...(p.enteredDate !== undefined
              ? { enteredDate: p.enteredDate as string | null }
              : {}),
            ...(p.isApproved !== undefined
              ? { isApproved: p.isApproved as boolean | null }
              : {}),
            ...(p.isContacted !== undefined
              ? { isContacted: p.isContacted as boolean | null }
              : {}),
            ...(p.isRejected !== undefined
              ? { isRejected: p.isRejected as boolean | null }
              : {}),
            ...(p.isPending !== undefined
              ? { isPending: p.isPending as boolean | null }
              : {}),
            ...(p.isDeleted !== undefined
              ? { isDeleted: p.isDeleted as boolean | null }
              : {}),
          };
        }),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRowId(null);
    }
  };

  const selectedIds =
    rowSelectionModel.type === "include"
      ? Array.from(rowSelectionModel.ids).filter(
          (id): id is string => typeof id === "string",
        )
      : rows
          .filter((row) => !rowSelectionModel.ids.has(row.id))
          .map((row) => row.id);
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const deletePayload = {
        isContacted: false,
        isApproved: false,
        isRejected: false,
        isPending: false,
        isDeleted: true,
      };
      await bulkUpdateSubmissions(selectedIds, deletePayload);
      setRowSelectionModel({ type: "include", ids: new Set() });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkPrint = async () => {
    if (selectedIds.length === 0) return;
    setBulkPrintLoading(true);
    try {
      const details = await Promise.all(
        selectedIds.map((id) => fetchSubmissionById(id)),
      );
      const forms = details.map((d) => toEditable(d));
      const passportsHtml = forms
        .map(
          (f) =>
            `<div style="page-break-inside:avoid;margin-bottom:12px">${buildPassportHtml(f)}</div>`,
        )
        .join("\n");

      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Bulk Passports</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  ${passportsHtml}
  <script>
    window.onload = function() {
      window.focus();
      window.print();
    };
    window.onafterprint = function() {
      window.close();
    };
  </script>
</body>
</html>`;
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setBulkPrintLoading(false);
    }
  };

  const ROW_STATUS_OPTIONS = [
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
    { label: "Deleted", value: "deleted" },
  ] as const;

  function getRowStatus(row: TableRecord): string {
    if (row.isPending) return "pending";
    if (row.isApproved) return "approved";
    if (row.isRejected) return "rejected";
    if (row.isDeleted) return "deleted";
    return "pending";
  }

  function getStatusPayload(value: string, row: TableRecord) {
    const payload: Parameters<typeof saveRowField>[1] = {
      isContacted: false,
      isApproved: value === "approved",
      isRejected: value === "rejected",
      isPending: value === "pending",
      isDeleted: value === "deleted",
    };
    if (value === "approved" || value === "rejected") {
      payload.enteredDate = new Date().toISOString();
      if (row.enteredBy != null && String(row.enteredBy).trim() !== "") {
        payload.enteredBy = row.enteredBy;
      }
    }
    return payload;
  }

  const columns: GridColDef<TableRecord>[] = [
    {
      field: "status",
      headerName: "Status",
      width: 130,
      sortable: false,
      renderCell: (params) => {
        const value = getRowStatus(params.row);
        return (
          <Select
            size="small"
            value={value}
            onChange={(e) => {
              const newValue = e.target.value as string;
              saveRowField(
                params.row.id,
                getStatusPayload(newValue, params.row),
              );
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            disabled={savingRowId === params.row.id}
            sx={{
              minWidth: 110,
              fontSize: 13,
              "& .MuiSelect-select": { py: 0.5 },
            }}
            MenuProps={{
              disablePortal: false,
              onClick: (e) => e.stopPropagation(),
              slotProps: {
                paper: {
                  style: { maxHeight: 48 * 4.5 },
                },
              },
            }}
          >
            {ROW_STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        );
      },
    },
    {
      field: "enteredBy",
      headerName: "Approved By",
      width: 140,
      sortable: false,
      renderCell: (params) => {
        const id = params.row.id;
        const current = (params.row.enteredBy ?? "") as string;
        const pending = pendingEnteredBy[id];
        const value = pending !== undefined ? pending : current;
        const hasChange = pending !== undefined && pending !== current;
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              width: "100%",
            }}
          >
            <TextField
              size="small"
              value={value}
              onChange={(e) =>
                setPendingEnteredBy((prev) => ({
                  ...prev,
                  [id]: e.target.value,
                }))
              }
              onClick={(e) => e.stopPropagation()}
              sx={{ flex: 1, minWidth: 0 }}
              inputProps={{ style: { fontSize: 13 } }}
            />
            {hasChange && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  saveRowField(id, { enteredBy: pending ?? "" });
                }}
                disabled={savingRowId === id}
                sx={{ color: "success.main" }}
                aria-label="Save"
              >
                <CheckCircleOutlineRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        );
      },
    },
    {
      field: "enteredDate",
      headerName: "Approved Date",
      width: 150,
      sortable: false,
      renderCell: (params) => {
        const id = params.row.id;
        const rowDate = params.row.enteredDate as string | null | undefined;
        const current = rowDate
          ? new Date(rowDate).toISOString().slice(0, 10)
          : "";
        const pending = pendingEnteredDate[id];
        const value = pending !== undefined ? pending : current;
        const hasChange = pending !== undefined && pending !== current;
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              width: "100%",
            }}
          >
            <TextField
              size="small"
              type="date"
              value={value}
              onChange={(e) =>
                setPendingEnteredDate((prev) => ({
                  ...prev,
                  [id]: e.target.value,
                }))
              }
              onClick={(e) => e.stopPropagation()}
              sx={{ flex: 1, minWidth: 0 }}
              inputProps={{ style: { fontSize: 13 } }}
              InputLabelProps={{ shrink: true }}
            />
            {hasChange && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  saveRowField(id, { enteredDate: value || undefined });
                }}
                disabled={savingRowId === id}
                sx={{ color: "success.main" }}
                aria-label="Save"
              >
                <CheckCircleOutlineRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        );
      },
    },
    { field: "passportNo", headerName: "Passport No", width: 115 },
    { field: "firstName", headerName: "Name", flex: 1, minWidth: 130 },
    { field: "city", headerName: "City", width: 160 },
    { field: "phoneNumber", headerName: "Phone", width: 120 },
    { field: "profession", headerName: "Profession", width: 110 },
    { field: "place", headerName: "Place", width: 160 },
    {
      field: "registeringDate",
      headerName: "Date",
      width: 120,
      valueFormatter: (v) =>
        v ? new Date(v as string).toLocaleDateString() : "",
    },
    { field: "refNameOfThePerson", headerName: "Sales Officer", width: 160 },
    {
      field: "reportingManagerName",
      headerName: "Reporting Manager",
      width: 160,
      valueFormatter: (v) => (v ? String(v) : "-"),
    },
    {
      field: "actions",
      headerName: "View",
      width: 70,
      sortable: false,
      align: "center",
      renderCell: (params) => (
        <IconButton
          size="small"
          color="primary"
          onClick={() => setDetailId(params.row.id)}
          aria-label="View details"
        >
          <VisibilityIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const deletedColumns: GridColDef<TableRecord>[] = [
    { field: "passportNo", headerName: "Passport No", width: 115 },
    { field: "firstName", headerName: "Name", flex: 1, minWidth: 130 },
    { field: "city", headerName: "City", width: 110 },
    { field: "phoneNumber", headerName: "Phone", width: 120 },
    { field: "profession", headerName: "Profession", width: 110 },
    {
      field: "registeringDate",
      headerName: "Date",
      width: 120,
      valueFormatter: (v) =>
        v ? new Date(v as string).toLocaleDateString() : "",
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {isPriceEditor ? (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 2, flexShrink: 0, padding: "10px 0px", pr: "10px" }}
          useFlexGap
        >
          <Button
            size="small"
            variant="outlined"
            onClick={openUpdatePriceDialog}
            disabled={priceUpdating}
            startIcon={<CurrencyRupeeIcon />}
            sx={{
              padding: 1,
              fontWeight: 700,
              minWidth: 160,
              bgcolor: "#ffffff",
              color: "#d11b1b",
              border: "1px solid #d11b1b",
              "&:hover": {
                bgcolor: "rgba(209, 27, 27, 0.08)",
                border: "1px solid #d11b1b",
              },
            }}
          >
            Update Price
          </Button>
        </Stack>
      ) : (
        <>
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            sx={{ mb: 2, flexShrink: 0, padding: "10px 0px", pr: "10px" }}
            useFlexGap
          >
            <TextField
              size="small"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                minWidth: 200,
                maxWidth: 500,
                width: "100%",
                flex: 1,
                backgroundColor: "#ffffff",
                "& .MuiInputBase-root": { backgroundColor: "#ffffff" },
              }}
            />
            <DatePicker
              label="From"
              value={dateFrom ? dayjs(dateFrom) : null}
              onChange={(d) => setDateFrom(d ? d.format("YYYY-MM-DD") : "")}
              slotProps={{ textField: { size: "small" } }}
              sx={{ minWidth: 140 }}
            />
            <DatePicker
              label="To"
              value={dateTo ? dayjs(dateTo) : null}
              onChange={(d) => setDateTo(d ? d.format("YYYY-MM-DD") : "")}
              slotProps={{ textField: { size: "small" } }}
              sx={{ minWidth: 140 }}
            />

            {canExportExcel && (
              <Button
                size="small"
                variant="contained"
                onClick={openExportDialog}
                disabled={exportLoading}
                startIcon={<FileDownloadIcon />}
                sx={{
                  padding: 1,
                  fontWeight: 700,
                  minWidth: 160,
                  bgcolor: "#0CA65A",
                  color: "#ffffff",
                  border: "none",
                  "&:hover": {
                    bgcolor: "#038947",
                  },
                }}
              >
                Export Excel
              </Button>
            )}

            {canUpdatePrice && (
              <Button
                size="small"
                variant="outlined"
                onClick={openUpdatePriceDialog}
                disabled={priceUpdating}
                startIcon={<CurrencyRupeeIcon />}
                sx={{
                  padding: 1,
                  fontWeight: 700,
                  minWidth: 160,
                  bgcolor: "#ffffff",
                  color: "#d11b1b",
                  border: "1px solid #d11b1b",
                  "&:hover": {
                    bgcolor: "rgba(209, 27, 27, 0.08)",
                    border: "1px solid #d11b1b",
                  },
                }}
              >
                Update Price
              </Button>
            )}

            <IconButton
              size="small"
              onClick={handleOpenFilters}
              aria-label="More filters"
              sx={{
                ml: "auto",
                bgcolor: "#ffffff",
                borderRadius: 1,
                p: 1,
                color: "#000000",
                boxShadow: "0 0 0 4px #ffffff, 0 10px 22px rgba(0,0,0,0.25)",
                transition: "transform 120ms ease, box-shadow 120ms ease",
                "&:hover": {
                  transform: "translateY(-1px)",
                  boxShadow: "0 0 0 4px #ffffff, 0 14px 30px rgba(0,0,0,0.45)",
                },
              }}
            >
              <FilterListIcon fontSize="medium" />
            </IconButton>
          </Stack>

          <Popover
            open={filtersPopoverOpen}
            anchorEl={filtersPopoverAnchorEl}
            onClose={handleCloseFilters}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            PaperProps={{ sx: { p: 2, width: 420, maxWidth: "90vw" } }}
            disableRestoreFocus
          >
            <Stack spacing={2}>
              <FormControl size="small">
                <InputLabel id="status-filter-label-pop">Status</InputLabel>
                <Select
                  labelId="status-filter-label-pop"
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_DROPDOWN_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small">
                <InputLabel id="profession-filter-label-pop">
                  Profession
                </InputLabel>
                <Select
                  labelId="profession-filter-label-pop"
                  value={professionFilter}
                  label="Profession"
                  onChange={(e) => setProfessionFilter(e.target.value)}
                >
                  {PROFESSION_DROPDOWN_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Autocomplete
                multiple
                disablePortal
                size="small"
                options={salesOfficerOptions}
                value={salesOfficerSelected}
                onChange={(_, newValue) => setSalesOfficerSelected(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Sales Officer"
                    sx={{
                      backgroundColor: "#ffffff",
                      "& .MuiInputBase-root": { backgroundColor: "#ffffff" },
                    }}
                  />
                )}
              />

              <Autocomplete
                multiple
                disablePortal
                size="small"
                options={reportingManagerOptions}
                value={reportingManagerSelected}
                onChange={(_, newValue) =>
                  setReportingManagerSelected(newValue)
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Reporting Manager"
                    sx={{
                      backgroundColor: "#ffffff",
                      "& .MuiInputBase-root": { backgroundColor: "#ffffff" },
                    }}
                  />
                )}
              />

              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => {
                  setDeletedPage(0);
                  setDeletedDialogOpen(true);
                  handleCloseFilters();
                }}
                startIcon={<VisibilityIcon />}
              >
                View Deleted Records
              </Button>
            </Stack>
          </Popover>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {selectedIds.length > 0 && (
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{
                  flexShrink: 0,
                  py: 1,
                  px: 1.5,
                  backgroundColor: "action.selected",
                }}
              >
                <Typography variant="body2" fontWeight={500}>
                  {selectedIds.length} row{selectedIds.length !== 1 ? "s" : ""}{" "}
                  selected
                </Typography>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  startIcon={<DeleteIcon />}
                >
                  {bulkActionLoading ? "Updating…" : "Delete"}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleBulkPrint}
                  disabled={bulkPrintLoading}
                  startIcon={<PrintIcon />}
                >
                  {bulkPrintLoading ? "Loading…" : "Print"}
                </Button>
              </Stack>
            )}
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              paginationMode="server"
              rowCount={recordCount}
              paginationModel={{ page, pageSize }}
              onPaginationModelChange={(m) => {
                setPage(m.page);
                setPageSize(m.pageSize);
              }}
              pageSizeOptions={[10, 20, 50]}
              checkboxSelection
              rowSelectionModel={rowSelectionModel}
              onRowSelectionModelChange={(newModel) =>
                setRowSelectionModel(newModel)
              }
              disableRowSelectionOnClick
              sx={{
                flex: 1,
                minHeight: 0,
                height: "100%",
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "rgb(248, 250, 252) !important",
                },
                "& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeader": {
                  backgroundColor: "rgb(248, 250, 252) !important",
                },
                "& .MuiDataGrid-cell": {
                  display: "flex",
                  alignItems: "center",
                },
                "& .MuiDataGrid-row": {
                  maxHeight: "none !important",
                },
                "& .MuiDataGrid-cellCheckbox, & .MuiDataGrid-columnHeaderCheckbox":
                  {
                    alignItems: "center",
                  },
              }}
            />
          </Box>
        </>
      )}

      <Dialog
        open={!!detailId}
        onClose={() => setDetailId(null)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${adminColors.borderLight}`,
            boxShadow: adminColors.shadow,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${adminColors.borderLight}`,
            py: 2,
            color: adminColors.text,
            fontWeight: 700,
          }}
        >
          Passport No: {form.skPassportNo ?? "—"}
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              disabled={saveLoading}
              startIcon={<SaveIcon />}
              sx={{ fontWeight: 700, padding: "5px 24px" }}
            >
              {saveLoading ? "Saving..." : "Save"}
            </Button>
            <Button
              size="small"
              onClick={() => setDetailId(null)}
              startIcon={<CloseIcon />}
              sx={{ fontWeight: 600 }}
            >
              Close
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent
          sx={{
            pt: 2,
            backgroundColor: "#FFFFFF",
            "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" },
          }}
          ref={dialogContentRef}
        >
          {detailLoading && (
            <Box sx={{ pb: 3 }}>
              <Skeleton
                variant="text"
                width={160}
                height={28}
                sx={{ mb: 2, opacity: 0.4 }}
                animation="wave"
              />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                  mb: 2.5,
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    variant="rounded"
                    height={40}
                    sx={{ opacity: 0.35 }}
                    animation="wave"
                  />
                ))}
              </Box>
              <Skeleton
                variant="text"
                width={140}
                height={28}
                sx={{ mb: 2, opacity: 0.4 }}
                animation="wave"
              />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                  mb: 2.5,
                }}
              >
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    variant="rounded"
                    height={40}
                    sx={{ opacity: 0.35 }}
                    animation="wave"
                  />
                ))}
              </Box>
              <Skeleton
                variant="text"
                width={120}
                height={28}
                sx={{ mb: 2, opacity: 0.4 }}
                animation="wave"
              />
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    variant="rounded"
                    height={100}
                    sx={{ flex: "1 1 180px", minWidth: 180, opacity: 0.35 }}
                    animation="wave"
                  />
                ))}
              </Box>
            </Box>
          )}
          {detail &&
            !detailLoading &&
            (() => {
              const formType = getDialogFormType(form);
              return (
                <Box component="form" sx={{ pb: 3 }}>
                  {saveError && (
                    <Typography color="error" sx={{ mb: 2, fontSize: 14 }}>
                      {saveError}
                    </Typography>
                  )}

                  {formType === "masonBarBender" && (
                    <>
                      <DialogSectionHeader title="Personal information" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="First Name"
                          value={form.pi_firstName ?? ""}
                          onChange={(e) =>
                            setField("pi_firstName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Last Name"
                          value={form.pi_lastName ?? ""}
                          onChange={(e) =>
                            setField("pi_lastName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Profession</InputLabel>
                          <Select
                            value={form.pi_profession ?? "Mason"}
                            label="Profession"
                            onChange={(e) =>
                              setField("pi_profession", String(e.target.value))
                            }
                          >
                            <MenuItem value="Mason">Mason</MenuItem>
                            <MenuItem value="BarBender">BarBender</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Date of Birth"
                          type="date"
                          value={toDateInputValue(form.pi_dob)}
                          onChange={(e) => setField("pi_dob", e.target.value)}
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Phone Number"
                          value={form.pi_phone ?? ""}
                          onChange={(e) => setField("pi_phone", e.target.value)}
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="WhatsApp Number"
                          value={form.pi_whatsAppNumber ?? ""}
                          onChange={(e) =>
                            setField("pi_whatsAppNumber", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Email ID"
                          value={form.pi_emailId ?? ""}
                          onChange={(e) =>
                            setField("pi_emailId", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Address Line 1*"
                          value={form.pi_addressLane1 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Address Line 2"
                          value={form.pi_addressLane2 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Taluk*"
                          value={form.pi_taluk ?? ""}
                          onChange={(e) => setField("pi_taluk", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="District*"
                          value={form.pi_district ?? ""}
                          onChange={(e) =>
                            setField("pi_district", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="City*"
                          value={form.pi_city ?? ""}
                          onChange={(e) => setField("pi_city", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>State</InputLabel>
                          <Select
                            value={form.pi_state ?? "Karnataka"}
                            label="State"
                            onChange={(e) =>
                              setField("pi_state", String(e.target.value))
                            }
                          >
                            {STATES.map((s) => (
                              <MenuItem key={s} value={s}>
                                {s}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label="Pincode*"
                          value={form.pi_pincode ?? ""}
                          onChange={(e) =>
                            setField("pi_pincode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Landmark"
                          value={form.pi_landmark ?? ""}
                          onChange={(e) =>
                            setField("pi_landmark", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Anniversary Date"
                          type="date"
                          value={toDateInputValue(form.pi_anniversaryDate)}
                          onChange={(e) =>
                            setField("pi_anniversaryDate", e.target.value)
                          }
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>

                      <DialogSectionHeader title="Current location" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Location"
                          value={form.shop_location ?? ""}
                          onChange={(e) =>
                            setField("shop_location", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Address 1"
                          value={form.shop_Address1 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Address 2"
                          value={form.shop_Address2 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="District"
                          value={form.shop_District ?? ""}
                          onChange={(e) =>
                            setField("shop_District", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Taluk"
                          value={form.shop_Taluk ?? ""}
                          onChange={(e) =>
                            setField("shop_Taluk", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="City/Town"
                          value={form.shop_City ?? ""}
                          onChange={(e) =>
                            setField("shop_City", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Pincode"
                          value={form.shop_Pincode ?? ""}
                          onChange={(e) =>
                            setField("shop_Pincode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Landmark"
                          value={form.shop_Landmark ?? ""}
                          onChange={(e) =>
                            setField("shop_Landmark", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <Button
                          type="button"
                          variant="contained"
                          size="small"
                          startIcon={<LocationOnIcon />}
                          sx={{ fontWeight: 700, alignSelf: "center" }}
                        >
                          View Location
                        </Button>
                      </Box>

                      <DialogSectionHeader title="Sales officer details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Name Of The Person*"
                          value={form.ref_nameOfTheperson ?? ""}
                          onChange={(e) =>
                            setField("ref_nameOfTheperson", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Contact No*"
                          value={form.sod_place ?? ""}
                          onChange={(e) =>
                            setField("sod_place", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>

                      <DialogSectionHeader title="Reporting manager details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Reporting Manager"
                          value={form.reporting_manager_name ?? ""}
                          onChange={(e) =>
                            setField("reporting_manager_name", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>

                      <DialogSectionHeader title="Dealer details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Name Of The Dealer*"
                          value={form.sod_nameOfTheDealer ?? ""}
                          onChange={(e) =>
                            setField("sod_nameOfTheDealer", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Place*"
                          value={form.ref_place ?? ""}
                          onChange={(e) =>
                            setField("ref_place", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                    </>
                  )}

                  {formType === "architectEngineer" && (
                    <>
                      <DialogSectionHeader title="Personal information" />
                      <Box sx={dialogGridSx}>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Title</InputLabel>
                          <Select
                            value={form.title ?? "Mr."}
                            label="Title"
                            onChange={(e) =>
                              setField("title", String(e.target.value))
                            }
                          >
                            <MenuItem value="Mr.">Mr.</MenuItem>
                            <MenuItem value="Mrs.">Mrs.</MenuItem>
                            <MenuItem value="Ms.">Ms.</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="First Name"
                          value={form.pi_firstName ?? ""}
                          onChange={(e) =>
                            setField("pi_firstName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Last Name"
                          value={form.pi_lastName ?? ""}
                          onChange={(e) =>
                            setField("pi_lastName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Profession</InputLabel>
                          <Select
                            value={form.pi_profession ?? "Architect"}
                            label="Profession"
                            onChange={(e) =>
                              setField("pi_profession", String(e.target.value))
                            }
                          >
                            <MenuItem value="Architect">Architect</MenuItem>
                            <MenuItem value="Engineer">Engineer</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Phone Number"
                          value={form.pi_phone ?? ""}
                          onChange={(e) => setField("pi_phone", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="WhatsApp Number"
                          value={form.pi_whatsAppNumber ?? ""}
                          onChange={(e) =>
                            setField("pi_whatsAppNumber", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Email ID"
                          value={form.pi_emailId ?? ""}
                          onChange={(e) =>
                            setField("pi_emailId", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Date of Birth"
                          type="date"
                          value={toDateInputValue(form.pi_dob)}
                          onChange={(e) => setField("pi_dob", e.target.value)}
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Validation Code"
                          value={form.validationCode ?? ""}
                          onChange={(e) =>
                            setField("validationCode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Address Line 1*"
                          value={form.pi_addressLane1 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Address Line 2"
                          value={form.pi_addressLane2 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="City*"
                          value={form.pi_city ?? ""}
                          onChange={(e) => setField("pi_city", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>State</InputLabel>
                          <Select
                            value={form.pi_state ?? "Karnataka"}
                            label="State"
                            onChange={(e) =>
                              setField("pi_state", String(e.target.value))
                            }
                          >
                            {STATES.map((s) => (
                              <MenuItem key={s} value={s}>
                                {s}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label="Anniversary Date"
                          type="date"
                          value={toDateInputValue(form.pi_anniversaryDate)}
                          onChange={(e) =>
                            setField("pi_anniversaryDate", e.target.value)
                          }
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Other details" />
                      <Box sx={dialogGridSx}>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Same as above</InputLabel>
                          <Select
                            value={
                              form.sameAsAbove === true
                                ? "yes"
                                : form.sameAsAbove === false
                                  ? "no"
                                  : ""
                            }
                            label="Same as above"
                            onChange={(e) =>
                              setField("sameAsAbove", e.target.value === "yes")
                            }
                          >
                            <MenuItem value="">—</MenuItem>
                            <MenuItem value="yes">Yes</MenuItem>
                            <MenuItem value="no">No</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Remarks"
                          value={form.remarks ?? ""}
                          onChange={(e) => setField("remarks", e.target.value)}
                          fullWidth
                          size="small"
                          multiline
                          minRows={3}
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>
                      <DialogSectionHeader title="Office address" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Address 1"
                          value={form.shop_Address1 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Address 2"
                          value={form.shop_Address2 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="District"
                          value={form.shop_District ?? ""}
                          onChange={(e) =>
                            setField("shop_District", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Taluk"
                          value={form.shop_Taluk ?? ""}
                          onChange={(e) =>
                            setField("shop_Taluk", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="City/Town"
                          value={form.shop_City ?? ""}
                          onChange={(e) =>
                            setField("shop_City", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Pincode"
                          value={form.shop_Pincode ?? ""}
                          onChange={(e) =>
                            setField("shop_Pincode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Landmark"
                          value={form.shop_Landmark ?? ""}
                          onChange={(e) =>
                            setField("shop_Landmark", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>
                      <DialogSectionHeader title="Sales officer details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Name Of The Person*"
                          value={form.ref_nameOfTheperson ?? ""}
                          onChange={(e) =>
                            setField("ref_nameOfTheperson", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Contact No*"
                          value={form.ref_place ?? ""}
                          onChange={(e) =>
                            setField("ref_place", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Reporting manager details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Reporting Manager"
                          value={form.reporting_manager_name ?? ""}
                          onChange={(e) =>
                            setField("reporting_manager_name", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Dealer details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Name Of The Dealer*"
                          value={form.sod_nameOfTheDealer ?? ""}
                          onChange={(e) =>
                            setField("sod_nameOfTheDealer", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Place*"
                          value={form.sod_place ?? ""}
                          onChange={(e) =>
                            setField("sod_place", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                    </>
                  )}

                  {formType === "commercial" && (
                    <>
                      <DialogSectionHeader title="Personal information" />
                      <Box sx={dialogGridSx}>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Title</InputLabel>
                          <Select
                            value={form.title ?? "Mr."}
                            label="Title"
                            onChange={(e) =>
                              setField("title", String(e.target.value))
                            }
                          >
                            <MenuItem value="Mr.">Mr.</MenuItem>
                            <MenuItem value="Mrs.">Mrs.</MenuItem>
                            <MenuItem value="Ms.">Ms.</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="First Name*"
                          value={form.pi_firstName ?? ""}
                          onChange={(e) =>
                            setField("pi_firstName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Last Name"
                          value={form.pi_lastName ?? ""}
                          onChange={(e) =>
                            setField("pi_lastName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Age"
                          value={form.age ?? ""}
                          onChange={(e) => setField("age", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Profession"
                          value={form.pi_profession ?? "Commercial"}
                          onChange={(e) =>
                            setField("pi_profession", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Phone Number*"
                          value={form.pi_phone ?? ""}
                          onChange={(e) => setField("pi_phone", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="WhatsApp Number"
                          value={form.pi_whatsAppNumber ?? ""}
                          onChange={(e) =>
                            setField("pi_whatsAppNumber", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Email Id"
                          value={form.pi_emailId ?? ""}
                          onChange={(e) =>
                            setField("pi_emailId", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>
                      <DialogSectionHeader title="Other details" />
                      <Box sx={dialogGridSx}>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Same as above</InputLabel>
                          <Select
                            value={
                              form.sameAsAbove === true
                                ? "yes"
                                : form.sameAsAbove === false
                                  ? "no"
                                  : ""
                            }
                            label="Same as above"
                            onChange={(e) =>
                              setField("sameAsAbove", e.target.value === "yes")
                            }
                          >
                            <MenuItem value="">—</MenuItem>
                            <MenuItem value="yes">Yes</MenuItem>
                            <MenuItem value="no">No</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Remarks"
                          value={form.remarks ?? ""}
                          onChange={(e) => setField("remarks", e.target.value)}
                          fullWidth
                          size="small"
                          multiline
                          minRows={3}
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>
                      <DialogSectionHeader title="Permanent address" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Address Line 1*"
                          value={form.pi_addressLane1 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Address Line 2"
                          value={form.pi_addressLane2 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="City*"
                          value={form.pi_city ?? ""}
                          onChange={(e) => setField("pi_city", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>State</InputLabel>
                          <Select
                            value={form.pi_state ?? "Karnataka"}
                            label="State"
                            onChange={(e) =>
                              setField("pi_state", String(e.target.value))
                            }
                          >
                            {STATES.map((s) => (
                              <MenuItem key={s} value={s}>
                                {s}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label="Zip / Postal Code*"
                          value={form.pi_pincode ?? ""}
                          onChange={(e) =>
                            setField("pi_pincode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Site location" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Location"
                          value={form.shop_location ?? ""}
                          onChange={(e) =>
                            setField("shop_location", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Address 1"
                          value={form.shop_Address1 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Address 2"
                          value={form.shop_Address2 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="District"
                          value={form.shop_District ?? ""}
                          onChange={(e) =>
                            setField("shop_District", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Taluk"
                          value={form.shop_Taluk ?? ""}
                          onChange={(e) =>
                            setField("shop_Taluk", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="City/Town"
                          value={form.shop_City ?? ""}
                          onChange={(e) =>
                            setField("shop_City", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Pincode"
                          value={form.shop_Pincode ?? ""}
                          onChange={(e) =>
                            setField("shop_Pincode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Landmark"
                          value={form.shop_Landmark ?? ""}
                          onChange={(e) =>
                            setField("shop_Landmark", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>
                      <DialogSectionHeader title="Sales officer details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Name Of The Person*"
                          value={form.ref_nameOfTheperson ?? ""}
                          onChange={(e) =>
                            setField("ref_nameOfTheperson", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Contact No*"
                          value={form.ref_place ?? ""}
                          onChange={(e) =>
                            setField("ref_place", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Dealer details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Name Of The Dealer*"
                          value={form.sod_nameOfTheDealer ?? ""}
                          onChange={(e) =>
                            setField("sod_nameOfTheDealer", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Place*"
                          value={form.sod_place ?? ""}
                          onChange={(e) =>
                            setField("sod_place", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                    </>
                  )}

                  {formType === "individual" && (
                    <>
                      <DialogSectionHeader title="Personal information" />
                      <Box sx={dialogGridSx}>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Title</InputLabel>
                          <Select
                            value={form.title ?? "Mr."}
                            label="Title"
                            onChange={(e) =>
                              setField("title", String(e.target.value))
                            }
                          >
                            <MenuItem value="Mr.">Mr.</MenuItem>
                            <MenuItem value="Mrs.">Mrs.</MenuItem>
                            <MenuItem value="Ms.">Ms.</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="First Name*"
                          value={form.pi_firstName ?? ""}
                          onChange={(e) =>
                            setField("pi_firstName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Last Name"
                          value={form.pi_lastName ?? ""}
                          onChange={(e) =>
                            setField("pi_lastName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Age"
                          value={form.age ?? ""}
                          onChange={(e) => setField("age", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Profession"
                          value={form.pi_profession ?? "Individual"}
                          onChange={(e) =>
                            setField("pi_profession", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Phone Number*"
                          value={form.pi_phone ?? ""}
                          onChange={(e) => setField("pi_phone", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="WhatsApp Number"
                          value={form.pi_whatsAppNumber ?? ""}
                          onChange={(e) =>
                            setField("pi_whatsAppNumber", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Email Id"
                          value={form.pi_emailId ?? ""}
                          onChange={(e) =>
                            setField("pi_emailId", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>
                      <DialogSectionHeader title="Other details" />
                      <Box sx={dialogGridSx}>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Same as above</InputLabel>
                          <Select
                            value={
                              form.sameAsAbove === true
                                ? "yes"
                                : form.sameAsAbove === false
                                  ? "no"
                                  : ""
                            }
                            label="Same as above"
                            onChange={(e) =>
                              setField("sameAsAbove", e.target.value === "yes")
                            }
                          >
                            <MenuItem value="">—</MenuItem>
                            <MenuItem value="yes">Yes</MenuItem>
                            <MenuItem value="no">No</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Remarks"
                          value={form.remarks ?? ""}
                          onChange={(e) => setField("remarks", e.target.value)}
                          fullWidth
                          size="small"
                          multiline
                          minRows={3}
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>
                      <DialogSectionHeader title="Permanent address" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Address Line 1*"
                          value={form.pi_addressLane1 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Address Line 2"
                          value={form.pi_addressLane2 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="City*"
                          value={form.pi_city ?? ""}
                          onChange={(e) => setField("pi_city", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>State</InputLabel>
                          <Select
                            value={form.pi_state ?? "Karnataka"}
                            label="State"
                            onChange={(e) =>
                              setField("pi_state", String(e.target.value))
                            }
                          >
                            {STATES.map((s) => (
                              <MenuItem key={s} value={s}>
                                {s}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label="Zip / Postal Code*"
                          value={form.pi_pincode ?? ""}
                          onChange={(e) =>
                            setField("pi_pincode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Site location" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Location"
                          value={form.shop_location ?? ""}
                          onChange={(e) =>
                            setField("shop_location", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Address 1"
                          value={form.shop_Address1 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Address 2"
                          value={form.shop_Address2 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="District"
                          value={form.shop_District ?? ""}
                          onChange={(e) =>
                            setField("shop_District", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Taluk"
                          value={form.shop_Taluk ?? ""}
                          onChange={(e) =>
                            setField("shop_Taluk", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="City/Town"
                          value={form.shop_City ?? ""}
                          onChange={(e) =>
                            setField("shop_City", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Pincode"
                          value={form.shop_Pincode ?? ""}
                          onChange={(e) =>
                            setField("shop_Pincode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Landmark"
                          value={form.shop_Landmark ?? ""}
                          onChange={(e) =>
                            setField("shop_Landmark", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>
                      <DialogSectionHeader title="Sales officer details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Name Of The Person*"
                          value={form.ref_nameOfTheperson ?? ""}
                          onChange={(e) =>
                            setField("ref_nameOfTheperson", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Contact No*"
                          value={form.ref_place ?? ""}
                          onChange={(e) =>
                            setField("ref_place", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Dealer details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Name Of The Dealer*"
                          value={form.sod_nameOfTheDealer ?? ""}
                          onChange={(e) =>
                            setField("sod_nameOfTheDealer", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Place*"
                          value={form.sod_place ?? ""}
                          onChange={(e) =>
                            setField("sod_place", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                    </>
                  )}

                  {formType === "dealer" && (
                    <>
                      <DialogSectionHeader title="Personal information" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Dealership Name / Person Name*"
                          value={form.dealershipName ?? ""}
                          onChange={(e) =>
                            setField("dealershipName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Office Address Line 1*"
                          value={form.pi_addressLane1 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Office Address Line 2"
                          value={form.pi_addressLane2 ?? ""}
                          onChange={(e) =>
                            setField("pi_addressLane2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="City*"
                          value={form.pi_city ?? ""}
                          onChange={(e) => setField("pi_city", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>State</InputLabel>
                          <Select
                            value={form.pi_state ?? "Karnataka"}
                            label="State"
                            onChange={(e) =>
                              setField("pi_state", String(e.target.value))
                            }
                          >
                            {STATES.map((s) => (
                              <MenuItem key={s} value={s}>
                                {s}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label="Zip / Postal Code*"
                          value={form.pi_pincode ?? ""}
                          onChange={(e) =>
                            setField("pi_pincode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Contact Person*"
                          value={form.contactPerson ?? ""}
                          onChange={(e) =>
                            setField("contactPerson", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Mobile Number*"
                          value={form.pi_phone ?? ""}
                          onChange={(e) => setField("pi_phone", e.target.value)}
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Email"
                          value={form.pi_emailId ?? ""}
                          onChange={(e) =>
                            setField("pi_emailId", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="GST Number*"
                          value={form.gstNumber ?? ""}
                          onChange={(e) =>
                            setField("gstNumber", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="PAN Number"
                          value={form.panNumber ?? ""}
                          onChange={(e) =>
                            setField("panNumber", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Ownership type</InputLabel>
                          <Select
                            value={form.pi_profession ?? "Proprietor Ship"}
                            label="Ownership type"
                            onChange={(e) =>
                              setField("pi_profession", String(e.target.value))
                            }
                          >
                            <MenuItem value="Proprietor Ship">
                              Proprietor Ship
                            </MenuItem>
                            <MenuItem value="Partnership">Partnership</MenuItem>
                            <MenuItem value="Private Limited">
                              Private Limited
                            </MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                      <DialogSectionHeader title="Owner's information / Permanent address" />
                      <Box sx={dialogGridSx}>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Owner same as above</InputLabel>
                          <Select
                            value={
                              form.ownerSameAsAbove === true
                                ? "yes"
                                : form.ownerSameAsAbove === false
                                  ? "no"
                                  : ""
                            }
                            label="Owner same as above"
                            onChange={(e) =>
                              setField(
                                "ownerSameAsAbove",
                                e.target.value === "yes",
                              )
                            }
                          >
                            <MenuItem value="">—</MenuItem>
                            <MenuItem value="yes">Yes</MenuItem>
                            <MenuItem value="no">No</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Title</InputLabel>
                          <Select
                            value={form.ownerTitle ?? "Mr."}
                            label="Title"
                            onChange={(e) =>
                              setField("ownerTitle", String(e.target.value))
                            }
                          >
                            <MenuItem value="Mr.">Mr.</MenuItem>
                            <MenuItem value="Mrs.">Mrs.</MenuItem>
                            <MenuItem value="Ms.">Ms.</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Owner First Name*"
                          value={form.ownerFirstName ?? ""}
                          onChange={(e) =>
                            setField("ownerFirstName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Owner Last Name"
                          value={form.ownerLastName ?? ""}
                          onChange={(e) =>
                            setField("ownerLastName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Owner Address Line 1*"
                          value={form.ownerOfficeAddressLine1 ?? ""}
                          onChange={(e) =>
                            setField("ownerOfficeAddressLine1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Owner Address Line 2"
                          value={form.ownerOfficeAddressLine2 ?? ""}
                          onChange={(e) =>
                            setField("ownerOfficeAddressLine2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Owner City*"
                          value={form.ownerCity ?? ""}
                          onChange={(e) =>
                            setField("ownerCity", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Owner State</InputLabel>
                          <Select
                            value={form.ownerState ?? "Karnataka"}
                            label="Owner State"
                            onChange={(e) =>
                              setField("ownerState", String(e.target.value))
                            }
                          >
                            {STATES.map((s) => (
                              <MenuItem key={s} value={s}>
                                {s}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label="Owner Zip / Postal Code*"
                          value={form.ownerPostalCode ?? ""}
                          onChange={(e) =>
                            setField("ownerPostalCode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Owner Place*"
                          value={form.ownerPlace ?? ""}
                          onChange={(e) =>
                            setField("ownerPlace", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Owner Phone Number*"
                          value={form.ownerPhoneNumber ?? ""}
                          onChange={(e) =>
                            setField("ownerPhoneNumber", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Owner Email ID"
                          value={form.ownerEmailId ?? ""}
                          onChange={(e) =>
                            setField("ownerEmailId", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Second contact person" />
                      <Box sx={dialogGridSx}>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Title</InputLabel>
                          <Select
                            value={form.secondContactTitle ?? "Mr."}
                            label="Title"
                            onChange={(e) =>
                              setField(
                                "secondContactTitle",
                                String(e.target.value),
                              )
                            }
                          >
                            <MenuItem value="Mr.">Mr.</MenuItem>
                            <MenuItem value="Mrs.">Mrs.</MenuItem>
                            <MenuItem value="Ms.">Ms.</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="First Name"
                          value={form.secondContactFirstName ?? ""}
                          onChange={(e) =>
                            setField("secondContactFirstName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Last Name"
                          value={form.secondContactLastName ?? ""}
                          onChange={(e) =>
                            setField("secondContactLastName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Phone Number"
                          value={form.secondContactPhone ?? ""}
                          onChange={(e) =>
                            setField("secondContactPhone", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Email ID"
                          value={form.secondContactEmail ?? ""}
                          onChange={(e) =>
                            setField("secondContactEmail", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Greeting information" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Spouse Name"
                          value={form.spouseName ?? ""}
                          onChange={(e) =>
                            setField("spouseName", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Spouse DOB"
                          type="date"
                          value={toDateInputValue(form.spouseDob)}
                          onChange={(e) =>
                            setField("spouseDob", e.target.value)
                          }
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Wedding Day"
                          type="date"
                          value={toDateInputValue(form.weddingDay)}
                          onChange={(e) =>
                            setField("weddingDay", e.target.value)
                          }
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Child 1 Name"
                          value={form.childName1 ?? ""}
                          onChange={(e) =>
                            setField("childName1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Child 1 DOB"
                          type="date"
                          value={toDateInputValue(form.childDob1)}
                          onChange={(e) =>
                            setField("childDob1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Child 2 Name"
                          value={form.childName2 ?? ""}
                          onChange={(e) =>
                            setField("childName2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Child 2 DOB"
                          type="date"
                          value={toDateInputValue(form.childDob2)}
                          onChange={(e) =>
                            setField("childDob2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Child 3 Name"
                          value={form.childName3 ?? ""}
                          onChange={(e) =>
                            setField("childName3", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Child 3 DOB"
                          type="date"
                          value={toDateInputValue(form.childDob3)}
                          onChange={(e) =>
                            setField("childDob3", e.target.value)
                          }
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Depot/Godown information" />
                      <Box sx={dialogGridSx}>
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Godown same as company</InputLabel>
                          <Select
                            value={
                              form.godownSameAsCompany === true
                                ? "yes"
                                : form.godownSameAsCompany === false
                                  ? "no"
                                  : ""
                            }
                            label="Godown same as company"
                            onChange={(e) =>
                              setField(
                                "godownSameAsCompany",
                                e.target.value === "yes",
                              )
                            }
                          >
                            <MenuItem value="">—</MenuItem>
                            <MenuItem value="yes">Yes</MenuItem>
                            <MenuItem value="no">No</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Godown Address Line 1*"
                          value={form.godownAddressLine1 ?? ""}
                          onChange={(e) =>
                            setField("godownAddressLine1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Godown Address Line 2*"
                          value={form.godownAddressLine2 ?? ""}
                          onChange={(e) =>
                            setField("godownAddressLine2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                        <TextField
                          label="Godown City*"
                          value={form.godownCity ?? ""}
                          onChange={(e) =>
                            setField("godownCity", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <FormControl fullWidth size="small" sx={dialogInputSx}>
                          <InputLabel>Godown State</InputLabel>
                          <Select
                            value={form.godownState ?? "Karnataka"}
                            label="Godown State"
                            onChange={(e) =>
                              setField("godownState", String(e.target.value))
                            }
                          >
                            {STATES.map((s) => (
                              <MenuItem key={s} value={s}>
                                {s}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label="Godown Zip / Postal Code*"
                          value={form.godownPostalCode ?? ""}
                          onChange={(e) =>
                            setField("godownPostalCode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Godown Contact Person"
                          value={form.godownContactPerson ?? ""}
                          onChange={(e) =>
                            setField("godownContactPerson", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Godown Contact Mobile"
                          value={form.godownContactMobile ?? ""}
                          onChange={(e) =>
                            setField("godownContactMobile", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="Shop address" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Address 1"
                          value={form.shop_Address1 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Address 2"
                          value={form.shop_Address2 ?? ""}
                          onChange={(e) =>
                            setField("shop_Address2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="District"
                          value={form.shop_District ?? ""}
                          onChange={(e) =>
                            setField("shop_District", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Taluk"
                          value={form.shop_Taluk ?? ""}
                          onChange={(e) =>
                            setField("shop_Taluk", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="City/Town"
                          value={form.shop_City ?? ""}
                          onChange={(e) =>
                            setField("shop_City", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Pincode"
                          value={form.shop_Pincode ?? ""}
                          onChange={(e) =>
                            setField("shop_Pincode", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Landmark"
                          value={form.shop_Landmark ?? ""}
                          onChange={(e) =>
                            setField("shop_Landmark", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                        />
                      </Box>
                      <DialogSectionHeader title="Sales officer details" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Name Of The Person*"
                          value={form.ref_nameOfTheperson ?? ""}
                          onChange={(e) =>
                            setField("ref_nameOfTheperson", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Contact No*"
                          value={form.ref_place ?? ""}
                          onChange={(e) =>
                            setField("ref_place", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                      <DialogSectionHeader title="References" />
                      <Box sx={dialogGridSx}>
                        <TextField
                          label="Reference 1 Name"
                          value={form.referenceName1 ?? ""}
                          onChange={(e) =>
                            setField("referenceName1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Reference 1 Phone"
                          value={form.referencePhone1 ?? ""}
                          onChange={(e) =>
                            setField("referencePhone1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Reference 1 Details"
                          value={form.referenceDetails1 ?? ""}
                          onChange={(e) =>
                            setField("referenceDetails1", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Reference 2 Name"
                          value={form.referenceName2 ?? ""}
                          onChange={(e) =>
                            setField("referenceName2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Reference 2 Phone"
                          value={form.referencePhone2 ?? ""}
                          onChange={(e) =>
                            setField("referencePhone2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                        <TextField
                          label="Reference 2 Details"
                          value={form.referenceDetails2 ?? ""}
                          onChange={(e) =>
                            setField("referenceDetails2", e.target.value)
                          }
                          fullWidth
                          size="small"
                          sx={dialogInputSx}
                        />
                      </Box>
                    </>
                  )}

                  {formType !== "commercial" && formType !== "individual" && (
                    <>
                      <DialogSectionHeader title="Upload" />
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm:
                              formType === "dealer"
                                ? "repeat(4, 1fr)"
                                : "repeat(3, 1fr)",
                          },
                          gap: 2,
                          mb: 0,
                        }}
                      >
                        {formType === "dealer" ? (
                          <>
                            {/* Dealer: ID Proof */}
                            <Card
                              variant="outlined"
                              sx={{
                                borderRadius: 1.5,
                                borderColor: adminColors.borderLight,
                                overflow: "hidden",
                                height: "100%",
                              }}
                            >
                              <CardContent
                                sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}
                              >
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  sx={{ mb: 0.5 }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    color="text.primary"
                                  >
                                    ID Proof*
                                  </Typography>
                                  {(getImageSrc(
                                    form.idProofPath as string,
                                    form.idProofData as string,
                                  ) &&
                                    !clearedIdProof) ||
                                  idProofFile ? (
                                    <IconButton
                                      size="small"
                                      onClick={handleClearIdProof}
                                      aria-label="Remove ID proof"
                                      sx={{
                                        color: adminColors.textMuted,
                                        fontSize: 18,
                                      }}
                                    >
                                      ×
                                    </IconButton>
                                  ) : null}
                                </Stack>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mb: 1 }}
                                >
                                  Aadhar / Driving License / Voter ID
                                </Typography>
                                {(getImageSrc(
                                  form.idProofPath as string,
                                  form.idProofData as string,
                                ) &&
                                  !clearedIdProof) ||
                                idProofFile ? (
                                  <>
                                    {idProofFile ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ mb: 1 }}
                                      >
                                        New: {idProofFile.name}
                                      </Typography>
                                    ) : (
                                      <CardMedia
                                        component="img"
                                        image={
                                          getImageSrc(
                                            form.idProofPath as string,
                                            form.idProofData as string,
                                          ) ?? ""
                                        }
                                        alt="ID Proof"
                                        onClick={() => {
                                          const imgs = getFormImages();
                                          const idx = imgs.findIndex(
                                            (i) => i.label === "ID Proof",
                                          );
                                          if (idx >= 0)
                                            openImageGallery(imgs, idx);
                                        }}
                                        sx={{
                                          height: 120,
                                          objectFit: "contain",
                                          borderRadius: 1,
                                          bgcolor: "grey.100",
                                          mb: 1,
                                          cursor: "pointer",
                                          "&:hover": { opacity: 0.9 },
                                        }}
                                      />
                                    )}
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="label"
                                      startIcon={<UploadFileIcon />}
                                      sx={{ fontWeight: 600 }}
                                    >
                                      Change file
                                      <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.gif"
                                        hidden
                                        onChange={(e) =>
                                          setIdProofFile(
                                            e.target.files?.[0] ?? null,
                                          )
                                        }
                                      />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    component="label"
                                    startIcon={<UploadFileIcon />}
                                    sx={{ fontWeight: 600 }}
                                  >
                                    Upload
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.gif"
                                      hidden
                                      onChange={(e) =>
                                        setIdProofFile(
                                          e.target.files?.[0] ?? null,
                                        )
                                      }
                                    />
                                  </Button>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mt: 1 }}
                                >
                                  Accepted: .jpg, .jpeg, .png, .gif
                                </Typography>
                              </CardContent>
                            </Card>
                            {/* Dealer: GST Certificate */}
                            <Card
                              variant="outlined"
                              sx={{
                                borderRadius: 1.5,
                                borderColor: adminColors.borderLight,
                                overflow: "hidden",
                                height: "100%",
                              }}
                            >
                              <CardContent
                                sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}
                              >
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  sx={{ mb: 0.5 }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    color="text.primary"
                                  >
                                    GST Certificate*
                                  </Typography>
                                  {(getImageSrc(
                                    form.idProofBackPath as string,
                                    form.idProofBackData as string,
                                  ) &&
                                    !clearedIdProofBack) ||
                                  idProofBackFile ? (
                                    <IconButton
                                      size="small"
                                      onClick={handleClearIdProofBack}
                                      aria-label="Remove GST"
                                      sx={{
                                        color: adminColors.textMuted,
                                        fontSize: 18,
                                      }}
                                    >
                                      ×
                                    </IconButton>
                                  ) : null}
                                </Stack>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mb: 1 }}
                                >
                                  Any ID Proof
                                </Typography>
                                {(getImageSrc(
                                  form.idProofBackPath as string,
                                  form.idProofBackData as string,
                                ) &&
                                  !clearedIdProofBack) ||
                                idProofBackFile ? (
                                  <>
                                    {idProofBackFile ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ mb: 1 }}
                                      >
                                        New: {idProofBackFile.name}
                                      </Typography>
                                    ) : (
                                      <CardMedia
                                        component="img"
                                        image={
                                          getImageSrc(
                                            form.idProofBackPath as string,
                                            form.idProofBackData as string,
                                          ) ?? ""
                                        }
                                        alt="GST Certificate"
                                        onClick={() => {
                                          const imgs = getFormImages();
                                          const idx = imgs.findIndex(
                                            (i) =>
                                              i.label ===
                                              "Address Proof - Back Side",
                                          );
                                          if (idx >= 0)
                                            openImageGallery(imgs, idx);
                                        }}
                                        sx={{
                                          height: 120,
                                          objectFit: "contain",
                                          borderRadius: 1,
                                          bgcolor: "grey.100",
                                          mb: 1,
                                          cursor: "pointer",
                                          "&:hover": { opacity: 0.9 },
                                        }}
                                      />
                                    )}
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="label"
                                      startIcon={<UploadFileIcon />}
                                      sx={{ fontWeight: 600 }}
                                    >
                                      Change file
                                      <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.gif"
                                        hidden
                                        onChange={(e) =>
                                          setIdProofBackFile(
                                            e.target.files?.[0] ?? null,
                                          )
                                        }
                                      />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    component="label"
                                    startIcon={<UploadFileIcon />}
                                    sx={{ fontWeight: 600 }}
                                  >
                                    Upload
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.gif"
                                      hidden
                                      onChange={(e) =>
                                        setIdProofBackFile(
                                          e.target.files?.[0] ?? null,
                                        )
                                      }
                                    />
                                  </Button>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mt: 1 }}
                                >
                                  Accepted: .jpg, .jpeg, .png, .gif
                                </Typography>
                              </CardContent>
                            </Card>
                            {/* Dealer: PAN Card Copy */}
                            <Card
                              variant="outlined"
                              sx={{
                                borderRadius: 1.5,
                                borderColor: adminColors.borderLight,
                                overflow: "hidden",
                                height: "100%",
                              }}
                            >
                              <CardContent
                                sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}
                              >
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  sx={{ mb: 0.5 }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    color="text.primary"
                                  >
                                    PAN Card Copy
                                  </Typography>
                                  {(getImageSrc(
                                    form.panProofPath as string,
                                    form.panProofData as string,
                                  ) &&
                                    !clearedPanProof) ||
                                  panProofFile ? (
                                    <IconButton
                                      size="small"
                                      onClick={handleClearPanProof}
                                      aria-label="Remove PAN"
                                      sx={{
                                        color: adminColors.textMuted,
                                        fontSize: 18,
                                      }}
                                    >
                                      ×
                                    </IconButton>
                                  ) : null}
                                </Stack>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mb: 1 }}
                                >
                                  Any ID Proof
                                </Typography>
                                {(getImageSrc(
                                  form.panProofPath as string,
                                  form.panProofData as string,
                                ) &&
                                  !clearedPanProof) ||
                                panProofFile ? (
                                  <>
                                    {panProofFile ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ mb: 1 }}
                                      >
                                        New: {panProofFile.name}
                                      </Typography>
                                    ) : (
                                      <CardMedia
                                        component="img"
                                        image={
                                          getImageSrc(
                                            form.panProofPath as string,
                                            form.panProofData as string,
                                          ) ?? ""
                                        }
                                        alt="PAN Copy"
                                        onClick={() => {
                                          const imgs = getFormImages();
                                          const idx = imgs.findIndex(
                                            (i) => i.label === "PAN Card Copy",
                                          );
                                          if (idx >= 0)
                                            openImageGallery(imgs, idx);
                                        }}
                                        sx={{
                                          height: 120,
                                          objectFit: "contain",
                                          borderRadius: 1,
                                          bgcolor: "grey.100",
                                          mb: 1,
                                          cursor: "pointer",
                                          "&:hover": { opacity: 0.9 },
                                        }}
                                      />
                                    )}
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="label"
                                      startIcon={<UploadFileIcon />}
                                      sx={{ fontWeight: 600 }}
                                    >
                                      Change file
                                      <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.gif"
                                        hidden
                                        onChange={(e) =>
                                          setPanProofFile(
                                            e.target.files?.[0] ?? null,
                                          )
                                        }
                                      />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    component="label"
                                    startIcon={<UploadFileIcon />}
                                    sx={{ fontWeight: 600 }}
                                  >
                                    Upload
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.gif"
                                      hidden
                                      onChange={(e) =>
                                        setPanProofFile(
                                          e.target.files?.[0] ?? null,
                                        )
                                      }
                                    />
                                  </Button>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mt: 1 }}
                                >
                                  Accepted: .jpg, .jpeg, .png, .gif
                                </Typography>
                              </CardContent>
                            </Card>
                            {/* Dealer: Shop Photo - Front View */}
                            <Card
                              variant="outlined"
                              sx={{
                                borderRadius: 1.5,
                                borderColor: adminColors.borderLight,
                                overflow: "hidden",
                                height: "100%",
                              }}
                            >
                              <CardContent
                                sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}
                              >
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  sx={{ mb: 0.5 }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    color="text.primary"
                                  >
                                    Shop Photo - Front View*
                                  </Typography>
                                  {(getImageSrc(
                                    form.photoProofPath as string,
                                    form.photoProofData as string,
                                  ) &&
                                    !clearedPhotoProof) ||
                                  photoProofFile ? (
                                    <IconButton
                                      size="small"
                                      onClick={handleClearPhotoProof}
                                      aria-label="Remove photo"
                                      sx={{
                                        color: adminColors.textMuted,
                                        fontSize: 18,
                                      }}
                                    >
                                      ×
                                    </IconButton>
                                  ) : null}
                                </Stack>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mb: 1 }}
                                >
                                  Photo of the Shop
                                </Typography>
                                {(getImageSrc(
                                  form.photoProofPath as string,
                                  form.photoProofData as string,
                                ) &&
                                  !clearedPhotoProof) ||
                                photoProofFile ? (
                                  <>
                                    {photoProofFile ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ mb: 1 }}
                                      >
                                        New: {photoProofFile.name}
                                      </Typography>
                                    ) : (
                                      <CardMedia
                                        component="img"
                                        image={
                                          getImageSrc(
                                            form.photoProofPath as string,
                                            form.photoProofData as string,
                                          ) ?? ""
                                        }
                                        alt="Shop Photo"
                                        onClick={() => {
                                          const imgs = getFormImages();
                                          const idx = imgs.findIndex(
                                            (i) => i.label === "Photograph",
                                          );
                                          if (idx >= 0)
                                            openImageGallery(imgs, idx);
                                        }}
                                        sx={{
                                          height: 120,
                                          objectFit: "contain",
                                          borderRadius: 1,
                                          bgcolor: "grey.100",
                                          mb: 1,
                                          cursor: "pointer",
                                          "&:hover": { opacity: 0.9 },
                                        }}
                                      />
                                    )}
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="label"
                                      startIcon={<UploadFileIcon />}
                                      sx={{ fontWeight: 600 }}
                                    >
                                      Change file
                                      <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.gif"
                                        hidden
                                        onChange={(e) =>
                                          setPhotoProofFile(
                                            e.target.files?.[0] ?? null,
                                          )
                                        }
                                      />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    component="label"
                                    startIcon={<UploadFileIcon />}
                                    sx={{ fontWeight: 600 }}
                                  >
                                    Upload
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.gif"
                                      hidden
                                      onChange={(e) =>
                                        setPhotoProofFile(
                                          e.target.files?.[0] ?? null,
                                        )
                                      }
                                    />
                                  </Button>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mt: 1 }}
                                >
                                  Accepted: .jpg, .jpeg, .png, .gif
                                </Typography>
                              </CardContent>
                            </Card>
                          </>
                        ) : (
                          <>
                            {/* Photograph */}
                            <Card
                              variant="outlined"
                              sx={{
                                borderRadius: 1.5,
                                borderColor: adminColors.borderLight,
                                overflow: "hidden",
                                height: "100%",
                              }}
                            >
                              <CardContent
                                sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}
                              >
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  sx={{ mb: 0.5 }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    color="text.primary"
                                  >
                                    Photograph*
                                  </Typography>
                                  {(getImageSrc(
                                    form.photoProofPath as string,
                                    form.photoProofData as string,
                                  ) &&
                                    !clearedPhotoProof) ||
                                  photoProofFile ? (
                                    <IconButton
                                      size="small"
                                      onClick={handleClearPhotoProof}
                                      aria-label="Remove photo"
                                      sx={{
                                        color: adminColors.textMuted,
                                        fontSize: 18,
                                      }}
                                    >
                                      ×
                                    </IconButton>
                                  ) : null}
                                </Stack>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mb: 1 }}
                                >
                                  Please Capture/Upload your photograph here
                                </Typography>
                                {(getImageSrc(
                                  form.photoProofPath as string,
                                  form.photoProofData as string,
                                ) &&
                                  !clearedPhotoProof) ||
                                photoProofFile ? (
                                  <>
                                    {photoProofFile ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ mb: 1 }}
                                      >
                                        New: {photoProofFile.name}
                                      </Typography>
                                    ) : (
                                      <CardMedia
                                        component="img"
                                        image={
                                          getImageSrc(
                                            form.photoProofPath as string,
                                            form.photoProofData as string,
                                          ) ?? ""
                                        }
                                        alt="Photograph"
                                        onClick={() => {
                                          const imgs = getFormImages();
                                          const idx = imgs.findIndex(
                                            (i) => i.label === "Photograph",
                                          );
                                          if (idx >= 0)
                                            openImageGallery(imgs, idx);
                                        }}
                                        sx={{
                                          height: 120,
                                          objectFit: "contain",
                                          borderRadius: 1,
                                          bgcolor: "grey.100",
                                          mb: 1,
                                          cursor: "pointer",
                                          "&:hover": { opacity: 0.9 },
                                        }}
                                      />
                                    )}
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="label"
                                      startIcon={<UploadFileIcon />}
                                      sx={{ fontWeight: 600 }}
                                    >
                                      Change file
                                      <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.gif"
                                        hidden
                                        onChange={(e) =>
                                          setPhotoProofFile(
                                            e.target.files?.[0] ?? null,
                                          )
                                        }
                                      />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    component="label"
                                    startIcon={<UploadFileIcon />}
                                    sx={{ fontWeight: 600 }}
                                  >
                                    Upload
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.gif"
                                      hidden
                                      onChange={(e) =>
                                        setPhotoProofFile(
                                          e.target.files?.[0] ?? null,
                                        )
                                      }
                                    />
                                  </Button>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mt: 1 }}
                                >
                                  Accepted: .jpg, .jpeg, .png, .gif
                                </Typography>
                              </CardContent>
                            </Card>

                            {/* ID Proof */}
                            <Card
                              variant="outlined"
                              sx={{
                                borderRadius: 1.5,
                                borderColor: adminColors.borderLight,
                                overflow: "hidden",
                                height: "100%",
                              }}
                            >
                              <CardContent
                                sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}
                              >
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  sx={{ mb: 0.5 }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    color="text.primary"
                                  >
                                    ID Proof*
                                  </Typography>
                                  {(getImageSrc(
                                    form.idProofPath as string,
                                    form.idProofData as string,
                                  ) &&
                                    !clearedIdProof) ||
                                  idProofFile ? (
                                    <IconButton
                                      size="small"
                                      onClick={handleClearIdProof}
                                      aria-label="Remove ID proof"
                                      sx={{
                                        color: adminColors.textMuted,
                                        fontSize: 18,
                                      }}
                                    >
                                      ×
                                    </IconButton>
                                  ) : null}
                                </Stack>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mb: 1 }}
                                >
                                  Any ID Proof
                                </Typography>
                                {(getImageSrc(
                                  form.idProofPath as string,
                                  form.idProofData as string,
                                ) &&
                                  !clearedIdProof) ||
                                idProofFile ? (
                                  <>
                                    {idProofFile ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ mb: 1 }}
                                      >
                                        New: {idProofFile.name}
                                      </Typography>
                                    ) : (
                                      <CardMedia
                                        component="img"
                                        image={
                                          getImageSrc(
                                            form.idProofPath as string,
                                            form.idProofData as string,
                                          ) ?? ""
                                        }
                                        alt="ID Proof"
                                        onClick={() => {
                                          const imgs = getFormImages();
                                          const idx = imgs.findIndex(
                                            (i) => i.label === "ID Proof",
                                          );
                                          if (idx >= 0)
                                            openImageGallery(imgs, idx);
                                        }}
                                        sx={{
                                          height: 120,
                                          objectFit: "contain",
                                          borderRadius: 1,
                                          bgcolor: "grey.100",
                                          mb: 1,
                                          cursor: "pointer",
                                          "&:hover": { opacity: 0.9 },
                                        }}
                                      />
                                    )}
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="label"
                                      startIcon={<UploadFileIcon />}
                                      sx={{ fontWeight: 600 }}
                                    >
                                      Change file
                                      <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.gif"
                                        hidden
                                        onChange={(e) =>
                                          setIdProofFile(
                                            e.target.files?.[0] ?? null,
                                          )
                                        }
                                      />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    component="label"
                                    startIcon={<UploadFileIcon />}
                                    sx={{ fontWeight: 600 }}
                                  >
                                    Upload
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.gif"
                                      hidden
                                      onChange={(e) =>
                                        setIdProofFile(
                                          e.target.files?.[0] ?? null,
                                        )
                                      }
                                    />
                                  </Button>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mt: 1 }}
                                >
                                  Accepted: .jpg, .jpeg, .png, .gif
                                </Typography>
                              </CardContent>
                            </Card>

                            {/* Address Proof - Back Side */}
                            <Card
                              variant="outlined"
                              sx={{
                                borderRadius: 1.5,
                                borderColor: adminColors.borderLight,
                                overflow: "hidden",
                                height: "100%",
                              }}
                            >
                              <CardContent
                                sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}
                              >
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  sx={{ mb: 0.5 }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    color="text.primary"
                                  >
                                    Address Proof - Back Side
                                  </Typography>
                                  {(getImageSrc(
                                    form.idProofBackPath as string,
                                    form.idProofBackData as string,
                                  ) &&
                                    !clearedIdProofBack) ||
                                  idProofBackFile ? (
                                    <IconButton
                                      size="small"
                                      onClick={handleClearIdProofBack}
                                      aria-label="Remove address proof"
                                      sx={{
                                        color: adminColors.textMuted,
                                        fontSize: 18,
                                      }}
                                    >
                                      ×
                                    </IconButton>
                                  ) : null}
                                </Stack>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mb: 1 }}
                                >
                                  Any ID Proof
                                </Typography>
                                {(getImageSrc(
                                  form.idProofBackPath as string,
                                  form.idProofBackData as string,
                                ) &&
                                  !clearedIdProofBack) ||
                                idProofBackFile ? (
                                  <>
                                    {idProofBackFile ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ mb: 1 }}
                                      >
                                        New: {idProofBackFile.name}
                                      </Typography>
                                    ) : (
                                      <CardMedia
                                        component="img"
                                        image={
                                          getImageSrc(
                                            form.idProofBackPath as string,
                                            form.idProofBackData as string,
                                          ) ?? ""
                                        }
                                        alt="Address Proof Back"
                                        onClick={() => {
                                          const imgs = getFormImages();
                                          const idx = imgs.findIndex(
                                            (i) =>
                                              i.label ===
                                              "Address Proof - Back Side",
                                          );
                                          if (idx >= 0)
                                            openImageGallery(imgs, idx);
                                        }}
                                        sx={{
                                          height: 120,
                                          objectFit: "contain",
                                          borderRadius: 1,
                                          bgcolor: "grey.100",
                                          mb: 1,
                                          cursor: "pointer",
                                          "&:hover": { opacity: 0.9 },
                                        }}
                                      />
                                    )}
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="label"
                                      startIcon={<UploadFileIcon />}
                                      sx={{ fontWeight: 600 }}
                                    >
                                      Change file
                                      <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.gif"
                                        hidden
                                        onChange={(e) =>
                                          setIdProofBackFile(
                                            e.target.files?.[0] ?? null,
                                          )
                                        }
                                      />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    component="label"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    Upload
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.gif"
                                      hidden
                                      onChange={(e) =>
                                        setIdProofBackFile(
                                          e.target.files?.[0] ?? null,
                                        )
                                      }
                                    />
                                  </Button>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mt: 1 }}
                                >
                                  Accepted: .jpg, .jpeg, .png, .gif
                                </Typography>
                              </CardContent>
                            </Card>
                          </>
                        )}
                      </Box>

                      {formType === "masonBarBender" && detail && (
                        <Box
                          sx={{
                            mt: 20,
                            mb: 1.5,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                          }}
                        >
                          <Box
                            id="passport-to-progress-print"
                            sx={{
                              width: "700px",
                              maxWidth: "100%",
                              mx: "auto",
                              bgcolor: "#D6F4FA",
                              border: "none",
                              p: 1.5,
                              WebkitPrintColorAdjust: "exact",
                              printColorAdjust: "exact",
                            }}
                          >
                            <Typography
                              sx={{
                                fontWeight: 400,
                                fontSize: 18,
                                textAlign: "center",
                                borderBottom: "2px solid #0b0b0b",
                                pb: 0.8,
                                mb: 0.5,
                                lineHeight: 1.1,
                              }}
                            >
                              SK SUPER TMT PASSPORT TO PROGRESS
                            </Typography>

                            <Typography
                              sx={{
                                fontWeight: 800,
                                fontSize: 16,
                                textAlign: "right",
                                pr: 1,
                              }}
                            >
                              Passport No. {form.skPassportNo ?? "—"}
                            </Typography>

                            <Box
                              sx={{
                                mt: 1,
                                display: "grid",
                                gridTemplateColumns: "210px 1fr",
                                gap: 1,
                              }}
                            >
                              <Box
                                component="img"
                                src={
                                  getImageSrc(
                                    form.photoProofPath as string,
                                    form.photoProofData as string,
                                  ) ?? ""
                                }
                                alt="Photograph"
                                sx={{
                                  width: "200px",
                                  height: "230px",
                                  objectFit: "cover",
                                  border: "1px solid rgba(0,0,0,0.15)",
                                  bgcolor: "#ffffff",
                                }}
                              />

                              <Box sx={{ fontSize: 14, lineHeight: 1.35 }}>
                                {/* Ruler rows: underline touches card end by using negative horizontal margins */}
                                <Box
                                  sx={{
                                    borderBottom: "2px solid #0b0b0b",
                                    pb: 0.65,
                                    mb: 0.6,
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 400 }}>
                                    Name:{" "}
                                    {toUpperText(
                                      `${form.pi_firstName ?? ""} ${form.pi_lastName ?? ""}`.trim(),
                                    )}
                                  </Typography>
                                </Box>

                                <Box
                                  sx={{
                                    borderBottom: "2px solid #0b0b0b",
                                    pb: 0.65,
                                    mb: 0.6,
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 400 }}>
                                    {toUpperText(form.pi_addressLane1 ?? "—")}
                                  </Typography>
                                </Box>

                                <Box
                                  sx={{
                                    borderBottom: "2px solid #0b0b0b",
                                    pb: 0.65,
                                    mb: 0.6,
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 400 }}>
                                    {toUpperText(form.pi_addressLane2 ?? "")}
                                  </Typography>
                                </Box>

                                <Box
                                  sx={{
                                    borderBottom: "2px solid #0b0b0b",
                                    pb: 0.65,
                                    mb: 0.6,
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 400 }}>
                                    Pincode:{" "}
                                    {toUpperText(form.pi_pincode ?? "—")}{" "}
                                    <span>
                                      City: {toUpperText(form.pi_city ?? "—")}
                                    </span>{" "}
                                    <span style={{ marginLeft: 8 }}>
                                      State: {toUpperText(form.pi_state ?? "—")}
                                    </span>
                                  </Typography>
                                </Box>

                                <Box
                                  sx={{
                                    borderBottom: "2px solid #0b0b0b",
                                    pb: 0.65,
                                    mb: 0.6,
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 400 }}>
                                    Landmark:{" "}
                                    {toUpperText(form.pi_landmark ?? "—")}
                                  </Typography>
                                </Box>

                                <Box
                                  sx={{
                                    borderBottom: "2px solid #0b0b0b",
                                    pb: 0.65,
                                    mb: 0.6,
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 400 }}>
                                    Mobile Number:{" "}
                                    {toUpperText(form.pi_phone ?? "—")}{" "}
                                    <span style={{ marginLeft: 8 }}>
                                      DOB:{" "}
                                      {toUpperText(
                                        formatDateToDMY(form.pi_dob),
                                      )}
                                    </span>
                                  </Typography>
                                </Box>

                                {/* No underline for Operational Area and Reg. By (as requested) */}
                                <Box
                                  sx={{
                                    mt: 0.6,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 2,
                                  }}
                                >
                                  <Typography
                                    sx={{ fontSize: 13, fontWeight: 400 }}
                                  >
                                    Operational Area:{" "}
                                    {toUpperText(form.pi_city ?? "—")}
                                  </Typography>
                                  <Typography
                                    sx={{ fontSize: 13, fontWeight: 400 }}
                                  >
                                    Reg. By:{" "}
                                    {toUpperText(
                                      form.ref_nameOfTheperson ?? "—",
                                    )}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>

                            <Box
                              sx={{
                                mt: 1.2,
                                fontWeight: 900,
                                fontFamily: "monospace",
                                fontSize: 16,
                                textAlign: "center",
                              }}
                            >
                              <Typography
                                sx={{
                                  whiteSpace: "pre",
                                  fontSize: 18,
                                  letterSpacing: 2,
                                  fontWeight: 900,
                                }}
                              >
                                &lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
                              </Typography>
                              <Typography
                                sx={{
                                  whiteSpace: "pre",
                                  fontSize: 18,
                                  letterSpacing: 2,
                                  fontWeight: 900,
                                }}
                              >
                                &lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
                              </Typography>
                            </Box>
                          </Box>

                          <Box
                            sx={{
                              width: "700px",
                              maxWidth: "100%",
                              mx: "auto",
                              display: "flex",
                              justifyContent: "flex-end",
                            }}
                          >
                            <Button
                              variant="outlined"
                              startIcon={<PrintIcon />}
                              onClick={() => {
                                const source = document.getElementById(
                                  "passport-to-progress-print",
                                );
                                if (!source) return;

                                const passportNoForFile =
                                  String(form.skPassportNo ?? "").trim() ||
                                  "passport-to-progress";
                                const safeFileName = passportNoForFile.replace(
                                  /[\\/:*?"<>|]/g,
                                  "_",
                                );

                                const rect = source.getBoundingClientRect();
                                const PX_PER_MM = 3.7795275591;
                                const wMm = Math.ceil(rect.width / PX_PER_MM);
                                const hMm = Math.ceil(rect.height / PX_PER_MM);

                                const inlineComputedStyles = (
                                  src: Element,
                                  dst: Element,
                                ) => {
                                  const computed = window.getComputedStyle(src);
                                  const dstEl = dst as HTMLElement;
                                  if (dstEl.style) {
                                    for (let i = 0; i < computed.length; i++) {
                                      const prop = computed[i];
                                      dstEl.style.setProperty(
                                        prop,
                                        computed.getPropertyValue(prop),
                                      );
                                    }
                                  }
                                  for (
                                    let i = 0;
                                    i < src.children.length;
                                    i++
                                  ) {
                                    if (dst.children[i]) {
                                      inlineComputedStyles(
                                        src.children[i],
                                        dst.children[i],
                                      );
                                    }
                                  }
                                };

                                const clone = source.cloneNode(
                                  true,
                                ) as HTMLElement;
                                clone.removeAttribute("id");
                                inlineComputedStyles(source, clone);

                                clone.style.margin = "0";
                                clone.style.marginLeft = "0";
                                clone.style.marginRight = "0";
                                clone.style.width = "100%";
                                clone.style.maxWidth = "100%";
                                clone.style.position = "relative";
                                clone.style.left = "0";
                                clone.style.top = "0";
                                clone.style.transform = "none";
                                clone.style.boxSizing = "border-box";

                                const html = `<!DOCTYPE html>
<html>
<head>
  <title>${safeFileName}</title>
  <style>
    @page {
      size: ${wMm}mm ${hMm}mm;
      margin: 0;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${wMm}mm;
      height: ${hMm}mm;
      overflow: hidden;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
  <script>
    window.onload = function() {
      window.focus();
      window.print();
    };
    window.onafterprint = function() {
      window.close();
    };
  </script>
</body>
</html>`;
                                const blob = new Blob([html], {
                                  type: "text/html",
                                });
                                const url = URL.createObjectURL(blob);
                                window.open(url, "_blank", "noopener");
                                URL.revokeObjectURL(url);
                              }}
                              sx={{
                                fontWeight: 800,
                                borderColor: adminColors.borderLight,
                              }}
                            >
                              Print
                            </Button>
                          </Box>

                          <style>{`/* Print styles are injected dynamically by the Print button handler. */`}</style>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Image Gallery Dialog */}
      <Dialog
        open={imageGalleryOpen}
        onClose={() => setImageGalleryOpen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: "90vw",
            maxHeight: "90vh",
            bgcolor: "rgba(0,0,0,0.95)",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "white",
            py: 1,
          }}
        >
          <Typography variant="subtitle1" component="span">
            {imageGalleryImages[imageGalleryIndex]?.label}
          </Typography>
          <IconButton
            onClick={() => setImageGalleryOpen(false)}
            sx={{ color: "white" }}
            aria-label="Close"
          >
            ×
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ position: "relative", p: 0, overflow: "hidden" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 400,
              position: "relative",
            }}
          >
            {imageGalleryImages.length > 0 && (
              <>
                {imageGalleryImages.length > 1 && (
                  <IconButton
                    onClick={() =>
                      setImageGalleryIndex((i) =>
                        i <= 0 ? imageGalleryImages.length - 1 : i - 1,
                      )
                    }
                    sx={{
                      position: "absolute",
                      left: 8,
                      color: "white",
                      bgcolor: "rgba(255,255,255,0.15)",
                      "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
                      zIndex: 1,
                    }}
                    aria-label="Previous image"
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                )}
                <Box
                  component="img"
                  src={imageGalleryImages[imageGalleryIndex]?.src}
                  alt={imageGalleryImages[imageGalleryIndex]?.label}
                  sx={{
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                  }}
                />
                {imageGalleryImages.length > 1 && (
                  <IconButton
                    onClick={() =>
                      setImageGalleryIndex((i) =>
                        i >= imageGalleryImages.length - 1 ? 0 : i + 1,
                      )
                    }
                    sx={{
                      position: "absolute",
                      right: 8,
                      color: "white",
                      bgcolor: "rgba(255,255,255,0.15)",
                      "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
                      zIndex: 1,
                    }}
                    aria-label="Next image"
                  >
                    <ChevronRightIcon />
                  </IconButton>
                )}
              </>
            )}
          </Box>
          {imageGalleryImages.length > 1 && (
            <Stack
              direction="row"
              justifyContent="center"
              gap={0.5}
              sx={{ py: 1.5, bgcolor: "rgba(0,0,0,0.5)" }}
            >
              {imageGalleryImages.map((img, idx) => (
                <Box
                  key={idx}
                  component="img"
                  src={img.src}
                  alt={img.label}
                  onClick={() => setImageGalleryIndex(idx)}
                  sx={{
                    width: 56,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 1,
                    border: idx === imageGalleryIndex ? 2 : 0,
                    borderColor: "primary.main",
                    cursor: "pointer",
                    opacity: idx === imageGalleryIndex ? 1 : 0.6,
                    "&:hover": { opacity: 1 },
                  }}
                />
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            borderBottom: `1px solid ${adminColors.borderLight}`,
            py: 2,
            fontWeight: 800,
          }}
        >
          Export Submissions to Excel
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <DatePicker
              label="From"
              value={exportFrom ? dayjs(exportFrom) : null}
              onChange={(d) => setExportFrom(d ? d.format("YYYY-MM-DD") : "")}
              slotProps={{ textField: { size: "small" } }}
              sx={{ width: "100%" }}
            />
            <DatePicker
              label="To"
              value={exportTo ? dayjs(exportTo) : null}
              onChange={(d) => setExportTo(d ? d.format("YYYY-MM-DD") : "")}
              slotProps={{ textField: { size: "small" } }}
              sx={{ width: "100%" }}
            />

            <FormControl size="small" fullWidth>
              <InputLabel id="export-formtype-label">Form Type</InputLabel>
              <Select
                labelId="export-formtype-label"
                value={exportFormType}
                label="Form Type"
                onChange={(e) => setExportFormType(String(e.target.value))}
              >
                {PROFESSION_DROPDOWN_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              options={salesOfficerOptions}
              value={exportSalesOfficer}
              onChange={(_, value) => setExportSalesOfficer(value)}
              sx={{
                "& .MuiOutlinedInput-root": { bgcolor: "#fff !important" },
              }}
              slotProps={{
                paper: { sx: { bgcolor: "#fff" } },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Sales Officer"
                  placeholder={
                    exportSalesOfficer.length === 0
                      ? "All Sales Officers"
                      : undefined
                  }
                />
              )}
            />
            <Autocomplete
              multiple
              options={reportingManagerOptions}
              value={exportReportingManager}
              onChange={(_, value) => setExportReportingManager(value)}
              sx={{
                "& .MuiOutlinedInput-root": { bgcolor: "#fff !important" },
              }}
              slotProps={{
                paper: { sx: { bgcolor: "#fff" } },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Reporting Manager"
                  placeholder={
                    exportReportingManager.length === 0
                      ? "All Reporting Managers"
                      : undefined
                  }
                />
              )}
            />

            {exportError && (
              <Typography color="error" sx={{ fontSize: 13 }}>
                {exportError}
              </Typography>
            )}

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 1,
                mt: 1,
              }}
            >
              <Button
                size="small"
                variant="outlined"
                onClick={() => setExportDialogOpen(false)}
                disabled={exportLoading}
                startIcon={<CancelIcon />}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleExportExcel}
                disabled={exportLoading}
                startIcon={<FileDownloadIcon />}
                sx={{
                  fontWeight: 800,
                  bgcolor: "#0CA65A",
                  "&:hover": {
                    bgcolor: "#038947",
                  },
                }}
              >
                {exportLoading ? "Exporting..." : "Export"}
              </Button>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={priceDialogOpen}
        onClose={() => setPriceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            borderBottom: `1px solid ${adminColors.borderLight}`,
            py: 2,
            fontWeight: 800,
          }}
        >
          Update Price
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Price"
              type="number"
              size="small"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              disabled={priceUpdating}
              inputProps={{ min: 0, step: 1 }}
              fullWidth
            />

            {priceDialogError && (
              <Typography color="error" sx={{ fontSize: 13 }}>
                {priceDialogError}
              </Typography>
            )}

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 1,
                mt: 1,
              }}
            >
              <Button
                size="small"
                variant="outlined"
                onClick={() => setPriceDialogOpen(false)}
                disabled={priceUpdating}
                startIcon={<CancelIcon />}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleUpdatePrice}
                disabled={priceUpdating}
                startIcon={<CurrencyRupeeIcon />}
                sx={{
                  fontWeight: 800,
                  bgcolor: "#0CA65A",
                  "&:hover": {
                    bgcolor: "#038947",
                  },
                }}
              >
                {priceUpdating ? "Updating..." : "Update"}
              </Button>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletedDialogOpen}
        onClose={() => setDeletedDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          Deleted Records
          <Button
            size="small"
            onClick={() => setDeletedDialogOpen(false)}
            startIcon={<CloseIcon />}
          >
            Close
          </Button>
        </DialogTitle>
        <DialogContent sx={{ height: 520 }}>
          <DataGrid
            rows={deletedRows}
            columns={deletedColumns}
            loading={deletedLoading}
            paginationMode="server"
            rowCount={deletedRecordCount}
            paginationModel={{ page: deletedPage, pageSize: deletedPageSize }}
            onPaginationModelChange={(m) => {
              setDeletedPage(m.page);
              setDeletedPageSize(m.pageSize);
            }}
            pageSizeOptions={[10, 20, 50]}
            disableRowSelectionOnClick
            sx={{
              height: "100%",
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "rgb(248, 250, 252) !important",
              },
              "& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeader": {
                backgroundColor: "rgb(248, 250, 252) !important",
              },
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
