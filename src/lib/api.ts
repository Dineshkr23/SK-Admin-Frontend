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
  recordCount: number;
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
  professionTypes?: string;
  isContacted?: boolean;
  isApproved?: boolean;
  isDeleted?: boolean;
  isActive?: boolean;
  isPending?: boolean;
  isRejected?: boolean;
  page?: number;
  limit?: number;
}): Promise<ListResponse> {
  const searchParams: Record<string, string> = {};
  if (params.page != null) searchParams.page = String(params.page);
  if (params.limit != null) searchParams.limit = String(params.limit);
  if (params.search) searchParams.search = params.search;
  if (params.professionTypes) searchParams.professionTypes = params.professionTypes;
  if (params.isContacted !== undefined) searchParams.isContacted = String(params.isContacted);
  if (params.isApproved !== undefined) searchParams.isApproved = String(params.isApproved);
  if (params.isDeleted !== undefined) searchParams.isDeleted = String(params.isDeleted);
  if (params.isActive !== undefined) searchParams.isActive = String(params.isActive);
  if (params.isPending !== undefined) searchParams.isPending = String(params.isPending);
  if (params.isRejected !== undefined) searchParams.isRejected = String(params.isRejected);
  return api<ListResponse>('/admin/submissions', { params: searchParams });
}

export async function fetchSubmissionById(id: string): Promise<SubmissionDetail> {
  return api<SubmissionDetail>(`/admin/submissions/${id}`);
}

export async function updateSubmission(
  id: string,
  data: Partial<SubmissionDetail>,
  files?: { photoProof?: File; idProof?: File; idProofBack?: File }
): Promise<SubmissionDetail> {
  const token = getToken();
  if (!token) throw new Error('Unauthorized');

  const formData = new FormData();
  formData.append('data', JSON.stringify(data));
  if (files?.photoProof) formData.append('photoProof', files.photoProof);
  if (files?.idProof) formData.append('idProof', files.idProof);
  if (files?.idProofBack) formData.append('idProofBack', files.idProofBack);

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
