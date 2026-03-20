const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...init } = options;
  const url = new URL(path, API_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, v);
    });
  }
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init.headers,
  };
  const token = getToken();
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url.toString(), { ...init, headers });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as Promise<T>;
}

export async function login(email: string, password: string): Promise<{ access_token: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = 'Login failed';
    try {
      const json = JSON.parse(text) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export type TableRecord = {
  id: string;
  legacyId?: number | null;
  passportNo: string | null;
  firstName: string | null;
  city: string | null;
  phoneNumber: string | null;
  profession: string | null;
  place: string | null;
  registeringDate: string | null;
  enteredBy: string | null;
  enteredDate: string | null;
  refNameOfThePerson: string | null;
  isApproved: boolean | null;
  isContacted: boolean | null;
  isRejected: boolean | null;
  isPending: boolean | null;
  isDeleted: boolean | null;
};

export type ListResponse = {
  records: TableRecord[];
  recordCount: number;
};

export type SubmissionDetail = Record<string, unknown>;

export async function fetchSubmissions(params: {
  search?: string;
  formTypes?: string;
  isContacted?: boolean;
  isApproved?: boolean;
  isDeleted?: boolean;
  isActive?: boolean;
  isPending?: boolean;
  isRejected?: boolean;
  dateFrom?: string;
  dateTo?: string;
  salesOfficer?: string;
  reportingManager?: string;
  page?: number;
  limit?: number;
}): Promise<ListResponse> {
  const searchParams: Record<string, string> = {};
  if (params.page != null) searchParams.page = String(params.page);
  if (params.limit != null) searchParams.limit = String(params.limit);
  if (params.search) searchParams.search = params.search;
  if (params.formTypes) searchParams.formTypes = params.formTypes;
  if (params.isContacted !== undefined) searchParams.isContacted = String(params.isContacted);
  if (params.isApproved !== undefined) searchParams.isApproved = String(params.isApproved);
  if (params.isDeleted !== undefined) searchParams.isDeleted = String(params.isDeleted);
  if (params.isActive !== undefined) searchParams.isActive = String(params.isActive);
  if (params.isPending !== undefined) searchParams.isPending = String(params.isPending);
  if (params.isRejected !== undefined) searchParams.isRejected = String(params.isRejected);
  if (params.dateFrom) searchParams.dateFrom = params.dateFrom;
  if (params.dateTo) searchParams.dateTo = params.dateTo;
  if (params.salesOfficer) searchParams.salesOfficer = params.salesOfficer;
  if (params.reportingManager) searchParams.reportingManager = params.reportingManager;
  return api<ListResponse>('/admin/submissions', { params: searchParams });
}

export async function exportSubmissionsExcel(params: {
  dateFrom?: string;
  dateTo?: string;
  formTypes?: string; // comma-separated or a single formType
}): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  if (!token) throw new Error('Unauthorized');

  const res = await fetch(new URL('/admin/submissions/export', API_URL).toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      ...(params.formTypes ? { formTypes: params.formTypes } : {}),
    }),
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }

  const contentDisposition = res.headers.get('content-disposition') ?? '';
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  const filename = filenameMatch?.[1] ?? 'submissions-export.xlsx';

  const blob = await res.blob();
  return { blob, filename };
}

export async function fetchFilterOptions(field: 'salesOfficer' | 'reportingManager'): Promise<{ options: string[] }> {
  return api<{ options: string[] }>('/admin/submissions/filter-options', {
    params: { field },
  });
}

export async function fetchSubmissionById(id: string): Promise<SubmissionDetail> {
  return api<SubmissionDetail>(`/admin/submissions/${id}`);
}

export async function updateSubmission(
  id: string,
  data: Partial<SubmissionDetail>,
  files?: { photoProof?: File; idProof?: File; idProofBack?: File; panProof?: File }
): Promise<SubmissionDetail> {
  const token = getToken();
  if (!token) throw new Error('Unauthorized');

  const formData = new FormData();
  formData.append('data', JSON.stringify(data));
  if (files?.photoProof) formData.append('photoProof', files.photoProof);
  if (files?.idProof) formData.append('idProof', files.idProof);
  if (files?.idProofBack) formData.append('idProofBack', files.idProofBack);
  if (files?.panProof) formData.append('panProof', files.panProof);

  const res = await fetch(`${API_URL}/admin/submissions/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<SubmissionDetail>;
}

export async function bulkUpdateSubmissions(
  ids: string[],
  data: Partial<SubmissionDetail>,
  opts?: { limit?: number },
): Promise<{ updatedCount: number }> {
  return api<{ updatedCount: number }>('/admin/submissions/bulk', {
    method: 'PATCH',
    body: JSON.stringify({
      ids,
      data,
      ...(opts?.limit != null ? { limit: opts.limit } : {}),
    }),
  });
}

export async function fetchGlobalPrice(): Promise<{ price: number }> {
  return api<{ price: number }>('/admin/price');
}

export async function updateGlobalPrice(price: number): Promise<{ price: number }> {
  return api<{ price: number }>('/admin/price', {
    method: 'POST',
    body: JSON.stringify({ price }),
  });
}
