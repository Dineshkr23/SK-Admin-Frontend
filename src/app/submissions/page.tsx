"use client";

import { useCallback, useEffect, useState } from "react";
import {
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
  Skeleton,
} from "@mui/material";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import {
  fetchSubmissions,
  fetchSubmissionById,
  updateSubmission,
  type TableRecord,
  type SubmissionDetail,
} from "@/lib/api";
import {
  adminColors,
  adminSectionHeaderBarStyle,
  adminGridTwo,
  dialogInputSx,
} from "@/styles/adminTheme";

const PROFESSION_DROPDOWN_OPTIONS = [
  { label: "All professions", value: "" },
  { label: "Individual House Builder", value: "Individual" },
  { label: "Commercial House Builder", value: "Commercial" },
  { label: "Architect & Engineer", value: "Engineer,Architect" },
  { label: "SK Super TMT Dealership", value: "Proprietor,Partner" },
  { label: "Mason & BarBender", value: "Mason,BarBender" },
] as const;

const STATUS_DROPDOWN_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Contacted", value: "contacted" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Pending", value: "pending" },
  { label: "Deleted", value: "deleted" },
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

function buildUpdatePayload(form: EditableDetail): Partial<SubmissionDetail> {
  const payload: Record<string, unknown> = {};
  const keys = [
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
    "enteredBy",
    "isContacted",
    "isApproved",
    "isDeleted",
    "isActive",
    "isPending",
    "isRejected",
  ];
  for (const k of keys) {
    const v = form[k];
    if (v === undefined) continue;
    if (k.startsWith("is")) {
      payload[k] = v === true || v === "true";
    } else {
      payload[k] = v === "" ? undefined : v;
    }
  }
  return payload as Partial<SubmissionDetail>;
}

export default function SubmissionsPage() {
  const [rows, setRows] = useState<TableRecord[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [professionFilter, setProfessionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState<EditableDetail>({});
  const [photoProofFile, setPhotoProofFile] = useState<File | null>(null);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [idProofBackFile, setIdProofBackFile] = useState<File | null>(null);
  const [clearedPhotoProof, setClearedPhotoProof] = useState(false);
  const [clearedIdProof, setClearedIdProof] = useState(false);
  const [clearedIdProofBack, setClearedIdProofBack] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingEnteredBy, setPendingEnteredBy] = useState<
    Record<string, string>
  >({});
  const [pendingEnteredDate, setPendingEnteredDate] = useState<
    Record<string, string>
  >({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const professionTypes = professionFilter
      ? professionFilter
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const isContacted =
      statusFilter === "contacted"
        ? true
        : statusFilter
          ? undefined
          : undefined;
    const isApproved =
      statusFilter === "approved" ? true : statusFilter ? undefined : undefined;
    const isRejected =
      statusFilter === "rejected" ? true : statusFilter ? undefined : undefined;
    const isPending =
      statusFilter === "pending" ? true : statusFilter ? undefined : undefined;
    const isDeleted =
      statusFilter === "deleted" ? true : statusFilter ? undefined : undefined;
    const isActive =
      statusFilter === "active" ? true : statusFilter ? undefined : undefined;
    try {
      const res = await fetchSubmissions({
        page: page + 1,
        limit: pageSize,
        search: searchDebounced || undefined,
        professionTypes:
          professionTypes.length > 0 ? professionTypes.join(",") : undefined,
        isContacted,
        isApproved,
        isDeleted,
        isActive,
        isPending,
        isRejected,
      });
      setRows(res.records);
      setRecordCount(res.recordCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchDebounced, professionFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setForm({});
      setPhotoProofFile(null);
      setIdProofFile(null);
      setIdProofBackFile(null);
      setClearedPhotoProof(false);
      setClearedIdProof(false);
      setClearedIdProofBack(false);
      setSaveError(null);
      return;
    }
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
      };
      await updateSubmission(detailId, payload, {
        ...(photoProofFile && { photoProof: photoProofFile }),
        ...(idProofFile && { idProof: idProofFile }),
        ...(idProofBackFile && { idProofBack: idProofBackFile }),
      });
      const updated = await fetchSubmissionById(detailId);
      setDetail(updated);
      setForm(toEditable(updated));
      setPhotoProofFile(null);
      setIdProofFile(null);
      setIdProofBackFile(null);
      setClearedPhotoProof(false);
      setClearedIdProof(false);
      setClearedIdProofBack(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaveLoading(false);
    }
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
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRowId(null);
    }
  };

  const columns: GridColDef<TableRecord>[] = [
    {
      field: "isContacted",
      headerName: "Contacted",
      width: 95,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() =>
            saveRowField(params.row.id, {
              isContacted: true,
              isApproved: false,
              isRejected: false,
              isPending: false,
              isDeleted: false,
            })
          }
          disabled={savingRowId === params.row.id}
          sx={{
            color: params.row.isContacted ? "success.main" : "action.disabled",
          }}
          aria-label={params.row.isContacted ? "Contacted" : "Not contacted"}
        >
          <CheckCircleOutlineRoundedIcon fontSize="small" />
        </IconButton>
      ),
    },
    {
      field: "isApproved",
      headerName: "Approved",
      width: 95,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() =>
            saveRowField(params.row.id, {
              isContacted: false,
              isApproved: true,
              isRejected: false,
              isPending: false,
              isDeleted: false,
            })
          }
          disabled={savingRowId === params.row.id}
          sx={{
            color: params.row.isApproved ? "success.main" : "action.disabled",
          }}
          aria-label={params.row.isApproved ? "Approved" : "Not approved"}
        >
          <CheckCircleOutlineRoundedIcon fontSize="small" />
        </IconButton>
      ),
    },
    {
      field: "isRejected",
      headerName: "Rejected",
      width: 95,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() =>
            saveRowField(params.row.id, {
              isContacted: false,
              isApproved: false,
              isRejected: true,
              isPending: false,
              isDeleted: false,
            })
          }
          disabled={savingRowId === params.row.id}
          sx={{
            color: params.row.isRejected ? "success.main" : "action.disabled",
          }}
          aria-label={params.row.isRejected ? "Rejected" : "Not rejected"}
        >
          <CheckCircleOutlineRoundedIcon fontSize="small" />
        </IconButton>
      ),
    },
    {
      field: "isPending",
      headerName: "Pending",
      width: 95,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() =>
            saveRowField(params.row.id, {
              isContacted: false,
              isApproved: false,
              isRejected: false,
              isPending: true,
              isDeleted: false,
            })
          }
          disabled={savingRowId === params.row.id}
          sx={{
            color: params.row.isPending ? "success.main" : "action.disabled",
          }}
          aria-label={params.row.isPending ? "Pending" : "Not pending"}
        >
          <CheckCircleOutlineRoundedIcon fontSize="small" />
        </IconButton>
      ),
    },
    {
      field: "isDeleted",
      headerName: "Deleted",
      width: 95,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() =>
            saveRowField(params.row.id, {
              isContacted: false,
              isApproved: false,
              isRejected: false,
              isPending: false,
              isDeleted: true,
            })
          }
          disabled={savingRowId === params.row.id}
          sx={{
            color: params.row.isDeleted ? "success.main" : "action.disabled",
          }}
          aria-label={params.row.isDeleted ? "Deleted" : "Not deleted"}
        >
          <CheckCircleOutlineRoundedIcon fontSize="small" />
        </IconButton>
      ),
    },
    {
      field: "enteredBy",
      headerName: "Entered By",
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
      headerName: "Entered Date",
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
    { field: "city", headerName: "City", width: 110 },
    { field: "phoneNumber", headerName: "Phone", width: 120 },
    { field: "profession", headerName: "Profession", width: 110 },
    { field: "place", headerName: "Place", width: 110 },
    {
      field: "registeringDate",
      headerName: "Date",
      width: 120,
      valueFormatter: (v) =>
        v ? new Date(v as string).toLocaleDateString() : "",
    },
    { field: "refNameOfThePerson", headerName: "Sales Officer", width: 130 },
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
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        sx={{ mb: 2, flexShrink: 0, padding: "10px 0px" }}
        useFlexGap
      >
        <TextField
          size="small"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 200, maxWidth: 500, width: "100%", flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
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
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="profession-filter-label">Profession</InputLabel>
          <Select
            labelId="profession-filter-label"
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
      </Stack>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
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
              sx={{ fontWeight: 700, padding: "5px 24px" }}
            >
              {saveLoading ? "Saving..." : "Save"}
            </Button>
            <Button
              size="small"
              onClick={() => setDetailId(null)}
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
        >
          {detailLoading && (
            <Box sx={{ pb: 3 }}>
              <Skeleton variant="text" width={160} height={28} sx={{ mb: 2, opacity: 0.4 }} animation="wave" />
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2.5 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={40} sx={{ opacity: 0.35 }} animation="wave" />
                ))}
              </Box>
              <Skeleton variant="text" width={140} height={28} sx={{ mb: 2, opacity: 0.4 }} animation="wave" />
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2.5 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={40} sx={{ opacity: 0.35 }} animation="wave" />
                ))}
              </Box>
              <Skeleton variant="text" width={120} height={28} sx={{ mb: 2, opacity: 0.4 }} animation="wave" />
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={100} sx={{ flex: "1 1 180px", minWidth: 180, opacity: 0.35 }} animation="wave" />
                ))}
              </Box>
            </Box>
          )}
          {detail && !detailLoading && (
            <Box component="form" sx={{ pb: 3 }}>
              {saveError && (
                <Typography color="error" sx={{ mb: 2, fontSize: 14 }}>
                  {saveError}
                </Typography>
              )}

              {/* PERSONAL INFORMATION */}
              <Typography component="div" sx={adminSectionHeaderBarStyle}>
                Personal information
              </Typography>
              <Box
                sx={
                  {
                    ...adminGridTwo,
                    "& .MuiTextField-root": dialogInputSx,
                    "& .MuiFormControl-root": dialogInputSx,
                  } as object
                }
              >
                <TextField
                  placeholder="First Name"
                  value={form.pi_firstName ?? ""}
                  onChange={(e) => setField("pi_firstName", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Last Name"
                  value={form.pi_lastName ?? ""}
                  onChange={(e) => setField("pi_lastName", e.target.value)}
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
                    <MenuItem value="Barbender">Barbender</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  placeholder="DD-MM-YYYY"
                  type="date"
                  value={
                    typeof form.pi_dob === "string" && form.pi_dob
                      ? form.pi_dob.slice(0, 10)
                      : ""
                  }
                  onChange={(e) => setField("pi_dob", e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Phone Number"
                  value={form.pi_phone ?? ""}
                  onChange={(e) => setField("pi_phone", e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                />
                <TextField
                  placeholder="WhatsApp Number"
                  value={form.pi_whatsAppNumber ?? ""}
                  onChange={(e) =>
                    setField("pi_whatsAppNumber", e.target.value)
                  }
                  fullWidth
                  size="small"
                  sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                />
                <TextField
                  placeholder="Email ID"
                  value={form.pi_emailId ?? ""}
                  onChange={(e) => setField("pi_emailId", e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                />
                <TextField
                  placeholder="Address Line 1*"
                  value={form.pi_addressLane1 ?? ""}
                  onChange={(e) => setField("pi_addressLane1", e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                />
                <TextField
                  placeholder="Address Line 2"
                  value={form.pi_addressLane2 ?? ""}
                  onChange={(e) => setField("pi_addressLane2", e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                />
                <TextField
                  placeholder="Taluk*"
                  value={form.pi_taluk ?? ""}
                  onChange={(e) => setField("pi_taluk", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="District*"
                  value={form.pi_district ?? ""}
                  onChange={(e) => setField("pi_district", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="City*"
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
                  placeholder="Pincode*"
                  value={form.pi_pincode ?? ""}
                  onChange={(e) => setField("pi_pincode", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Landmark"
                  value={form.pi_landmark ?? ""}
                  onChange={(e) => setField("pi_landmark", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Anniversary Date"
                  type="date"
                  value={
                    typeof form.pi_anniversaryDate === "string" &&
                    form.pi_anniversaryDate
                      ? form.pi_anniversaryDate.slice(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    setField("pi_anniversaryDate", e.target.value)
                  }
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                />
              </Box>

              {/* CURRENT LOCATION */}
              <Typography component="div" sx={adminSectionHeaderBarStyle}>
                Current location
              </Typography>
              <Box
                sx={
                  {
                    ...adminGridTwo,
                    "& .MuiTextField-root": dialogInputSx,
                    "& .MuiFormControl-root": dialogInputSx,
                  } as object
                }
              >
                <TextField
                  placeholder="Location"
                  value={form.shop_location ?? ""}
                  onChange={(e) => setField("shop_location", e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ gridColumn: "1 / -1", ...dialogInputSx }}
                />
                <TextField
                  placeholder="Address 1"
                  value={form.shop_Address1 ?? ""}
                  onChange={(e) => setField("shop_Address1", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Address 2"
                  value={form.shop_Address2 ?? ""}
                  onChange={(e) => setField("shop_Address2", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="District"
                  value={form.shop_District ?? ""}
                  onChange={(e) => setField("shop_District", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Taluk"
                  value={form.shop_Taluk ?? ""}
                  onChange={(e) => setField("shop_Taluk", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="City/Town"
                  value={form.shop_City ?? ""}
                  onChange={(e) => setField("shop_City", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Enter Pincode"
                  value={form.shop_Pincode ?? ""}
                  onChange={(e) => setField("shop_Pincode", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Landmark"
                  value={form.shop_Landmark ?? ""}
                  onChange={(e) => setField("shop_Landmark", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <Button
                  type="button"
                  variant="contained"
                  size="small"
                  sx={{ fontWeight: 700, alignSelf: "center" }}
                >
                  View Location
                </Button>
              </Box>

              {/* SALES OFFICER DETAILS */}
              <Typography component="div" sx={adminSectionHeaderBarStyle}>
                Sales officer details
              </Typography>
              <Box sx={adminGridTwo}>
                <TextField
                  placeholder="Name Of The Person*"
                  value={form.ref_nameOfTheperson ?? ""}
                  onChange={(e) =>
                    setField("ref_nameOfTheperson", e.target.value)
                  }
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Contact No*"
                  value={form.ref_place ?? ""}
                  onChange={(e) => setField("ref_place", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
              </Box>

              {/* DEALER DETAILS */}
              <Typography component="div" sx={adminSectionHeaderBarStyle}>
                Dealer details
              </Typography>
              <Box sx={adminGridTwo}>
                <TextField
                  placeholder="Name Of The Dealer*"
                  value={form.sod_nameOfTheDealer ?? ""}
                  onChange={(e) =>
                    setField("sod_nameOfTheDealer", e.target.value)
                  }
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
                <TextField
                  placeholder="Place*"
                  value={form.sod_place ?? ""}
                  onChange={(e) => setField("sod_place", e.target.value)}
                  fullWidth
                  size="small"
                  sx={dialogInputSx}
                />
              </Box>

              {/* UPLOAD - Image cards with MUI Card */}
              <Typography component="div" sx={adminSectionHeaderBarStyle}>
                Upload
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  gap: 2,
                  mb: 0,
                }}
              >
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
                  <CardContent sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}>
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
                          sx={{ color: adminColors.textMuted, fontSize: 18 }}
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
                            sx={{
                              height: 120,
                              objectFit: "contain",
                              borderRadius: 1,
                              bgcolor: "grey.100",
                              mb: 1,
                            }}
                          />
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          component="label"
                          sx={{ fontWeight: 600 }}
                        >
                          Change file
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif"
                            hidden
                            onChange={(e) =>
                              setPhotoProofFile(e.target.files?.[0] ?? null)
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
                            setPhotoProofFile(e.target.files?.[0] ?? null)
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
                  <CardContent sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}>
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
                          sx={{ color: adminColors.textMuted, fontSize: 18 }}
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
                            sx={{
                              height: 120,
                              objectFit: "contain",
                              borderRadius: 1,
                              bgcolor: "grey.100",
                              mb: 1,
                            }}
                          />
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          component="label"
                          sx={{ fontWeight: 600 }}
                        >
                          Change file
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif"
                            hidden
                            onChange={(e) =>
                              setIdProofFile(e.target.files?.[0] ?? null)
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
                            setIdProofFile(e.target.files?.[0] ?? null)
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
                  <CardContent sx={{ pb: 1, "&:last-child": { pb: 1.5 } }}>
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
                          sx={{ color: adminColors.textMuted, fontSize: 18 }}
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
                            sx={{
                              height: 120,
                              objectFit: "contain",
                              borderRadius: 1,
                              bgcolor: "grey.100",
                              mb: 1,
                            }}
                          />
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          component="label"
                          sx={{ fontWeight: 600 }}
                        >
                          Change file
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif"
                            hidden
                            onChange={(e) =>
                              setIdProofBackFile(e.target.files?.[0] ?? null)
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
                            setIdProofBackFile(e.target.files?.[0] ?? null)
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
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
