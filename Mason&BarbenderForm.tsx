import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

type UploadKey = "masonPhoto" | "masonIdProof" | "masonAddressProofBack";

type UploadPreviewState = {
  fileName: string;
  previewUrl: string;
};

type CameraModalState = {
  isOpen: boolean;
  uploadKey: UploadKey | null;
  error: string;
  capturedFile: File | null;
  capturedPreviewUrl: string;
};

type OtpVerificationState = {
  phoneNumber: string;
  token: string;
  checking: boolean;
  validating: boolean;
  isValidated: boolean;
  status: string;
};

const FORM_API_BASE = "https://backend.sksupertmt.com";

type SubmitState = {
  submitting: boolean;
  status: string;
  isSuccess: boolean;
};

type LocationState = {
  fetching: boolean;
  status: string;
  isSuccess: boolean;
};

const createOtpState = (): OtpVerificationState => ({
  phoneNumber: "",
  token: "",
  checking: false,
  validating: false,
  isValidated: false,
  status: "",
});

const FORM_FIELD_TO_BACKEND: Record<string, string> = {
  firstName: "pi_firstName",
  lastName: "pi_lastName",
  profession: "pi_profession",
  dateOfBirth: "pi_dob",
  phoneNumber: "pi_phone",
  whatsappNumber: "pi_whatsAppNumber",
  emailId: "pi_emailId",
  addressLine1: "pi_addressLane1",
  addressLine2: "pi_addressLane2",
  taluk: "pi_taluk",
  district: "pi_district",
  city: "pi_city",
  state: "pi_state",
  pincode: "pi_pincode",
  landmark: "pi_landmark",
  validationCode: "validationCode",
  sameAsAbove: "sameAsAbove",
  remarks: "remarks",
  currentAddress1: "shop_Address1",
  currentAddress2: "shop_Address2",
  currentDistrict: "shop_District",
  currentTaluk: "shop_Taluk",
  currentCityTown: "shop_City",
  currentPincode: "shop_Pincode",
  currentLandmark: "shop_Landmark",
  salesOfficerName: "ref_nameOfTheperson",
  salesOfficerContact: "ref_place",
  reportingManagerName: "reporting_manager_name",
  dealerName: "sod_nameOfTheDealer",
  dealerPlace: "sod_place",
};

const createUploadState = (): Record<UploadKey, UploadPreviewState> => ({
  masonPhoto: { fileName: "", previewUrl: "" },
  masonIdProof: { fileName: "", previewUrl: "" },
  masonAddressProofBack: { fileName: "", previewUrl: "" },
});

function BarBendorsAndMasonsForm() {
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window === "undefined" ? 1200 : window.innerWidth,
  );
  const [otpState, setOtpState] =
    useState<OtpVerificationState>(createOtpState);
  const [uploadByKey, setUploadByKey] =
    useState<Record<UploadKey, UploadPreviewState>>(createUploadState);
  const [cameraModal, setCameraModal] = useState<CameraModalState>({
    isOpen: false,
    uploadKey: null,
    error: "",
    capturedFile: null,
    capturedPreviewUrl: "",
  });
  const [submitState, setSubmitState] = useState<SubmitState>({
    submitting: false,
    status: "",
    isSuccess: false,
  });
  const [locationState, setLocationState] = useState<LocationState>({
    fetching: false,
    status: "",
    isSuccess: false,
  });
  const [declarationChoice, setDeclarationChoice] = useState<
    "agree" | "disagree" | ""
  >("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const uploadInputRefs = useRef<Record<UploadKey, HTMLInputElement | null>>({
    masonPhoto: null,
    masonIdProof: null,
    masonAddressProofBack: null,
  });
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1100;
  const [dateOfBirth, setDateOfBirth] = useState("");
  const todayDate = new Date().toISOString().split("T")[0];
  const submitInFlightRef = useRef(false);
  const phoneCheckTimerRef = useRef<number | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [isSameAsAbove, setIsSameAsAbove] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [phoneAvailability, setPhoneAvailability] = useState({
    checking: false,
    exists: false,
    status: "",
  });

  const responsiveGridTwo = {
    ...gridTwo,
    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
  };

  const responsiveOtpGrid = {
    ...otpGrid,
    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
    alignItems: isMobile ? ("stretch" as const) : ("center" as const),
  };

  const responsiveUploadGrid = {
    ...uploadGridStyle,
    gridTemplateColumns: isMobile
      ? "1fr"
      : isTablet
        ? "repeat(2, minmax(0, 1fr))"
        : "repeat(3, minmax(0, 1fr))",
  };

  const sectionStyle = {
    maxWidth: 1040,
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: isMobile ? 14 : 18,
    boxShadow: "0 16px 40px rgba(16, 24, 40, 0.14)",
    padding: isMobile ? "18px 14px 26px" : "30px 28px 34px",
    border: "1px solid #eaecf0",
  };

  const submitButtonStyle = {
    border: "none",
    backgroundColor:
      submitState.submitting ||
      phoneAvailability.checking ||
      phoneAvailability.exists
        ? "#98a2b3"
        : "#d11b1b",
    color: "#ffffff",
    padding: isMobile ? "12px 20px" : "10px 34px",
    fontWeight: 700,
    borderRadius: 10,
    cursor:
      submitState.submitting ||
      phoneAvailability.checking ||
      phoneAvailability.exists
        ? "not-allowed"
        : "pointer",
    opacity: submitState.submitting ? 0.8 : 1,
    width: isMobile ? "100%" : "auto",
    minWidth: isMobile ? "100%" : 140,
  };

  const shouldUseModalCamera = () => {
    return !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
  };

  const setFieldIfEmpty = (name: string, value?: string) => {
    if (!formRef.current || !value) {
      return;
    }

    const input = formRef.current.elements.namedItem(name);
    if (
      !(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)
    ) {
      return;
    }

    if (!input.value.trim()) {
      input.value = value;
    }
  };
  const normalizePhone = (value: string): string =>
    value.replace(/\D/g, "").slice(-10);
  const canShowOtpControls =
    normalizePhone(otpState.phoneNumber).length === 10 &&
    !phoneAvailability.checking &&
    !phoneAvailability.exists;

  const fillLocationFields = (address: Record<string, string>) => {
    const cityValue =
      address.city ||
      address.town ||
      address.village ||
      address.locality ||
      address.municipality ||
      address.county ||
      address.state_district;
    const districtValue =
      address.state_district || address.county || address.district;
    const talukValue =
      address.suburb || address.neighbourhood || address.city_district;
    const landmarkValue =
      address.road ||
      address.neighbourhood ||
      address.suburb ||
      address.amenity;
    const line1Value =
      [address.house_number, address.road, address.suburb]
        .filter(Boolean)
        .join(", ") ||
      address.neighbourhood ||
      address.village ||
      "";

    const pincodeValue = address.postcode;

    // Fill current location / shop address only - do NOT prefill permanent address
    setFieldIfEmpty("currentAddress1", line1Value);
    setFieldIfEmpty("currentDistrict", districtValue);
    setFieldIfEmpty("currentTaluk", talukValue);
    setFieldIfEmpty("currentCityTown", cityValue);
    setFieldIfEmpty("currentPincode", pincodeValue);
    setFieldIfEmpty("currentLandmark", landmarkValue);
  };

  const reverseFromNominatim = async (latitude: number, longitude: number) => {
    const reverseResponse = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(
        String(latitude),
      )}&lon=${encodeURIComponent(String(longitude))}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const reverseBody = (await reverseResponse
      .json()
      .catch(() => null)) as unknown;
    if (!isRecord(reverseBody) || !isRecord(reverseBody.address)) {
      return null;
    }

    return reverseBody.address as Record<string, string>;
  };

  const reverseFromBigDataCloud = async (
    latitude: number,
    longitude: number,
  ) => {
    const reverseResponse = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        String(latitude),
      )}&longitude=${encodeURIComponent(String(longitude))}&localityLanguage=en`,
    );

    const reverseBody = (await reverseResponse
      .json()
      .catch(() => null)) as unknown;
    if (!isRecord(reverseBody)) {
      return null;
    }

    const localityInfo = isRecord(reverseBody.localityInfo)
      ? reverseBody.localityInfo
      : null;
    const adminInfo =
      localityInfo && Array.isArray(localityInfo.administrative)
        ? (localityInfo.administrative as Array<Record<string, unknown>>)
        : [];

    const districtCandidate = adminInfo.find((item) => {
      const order = item.order;
      return typeof order === "number" && order >= 5;
    });

    return {
      city: typeof reverseBody.city === "string" ? reverseBody.city : "",
      locality:
        typeof reverseBody.locality === "string" ? reverseBody.locality : "",
      county:
        districtCandidate && typeof districtCandidate.name === "string"
          ? districtCandidate.name
          : "",
      state:
        typeof reverseBody.principalSubdivision === "string"
          ? reverseBody.principalSubdivision
          : "",
      postcode:
        typeof reverseBody.postcode === "string" ? reverseBody.postcode : "",
    };
  };

  const fetchAndFillLocation = async (triggeredByUser: boolean) => {
    if (!navigator.geolocation) {
      setLocationState({
        fetching: false,
        isSuccess: false,
        status: triggeredByUser
          ? "Geolocation is not supported on this device."
          : "",
      });
      return;
    }

    if (!window.isSecureContext) {
      setLocationState({
        fetching: false,
        isSuccess: false,
        status: triggeredByUser
          ? "Location requires HTTPS or localhost in mobile browsers."
          : "",
      });
      return;
    }

    setLocationState({
      fetching: true,
      isSuccess: false,
      status: "Fetching current location...",
    });

    const coordinates = await new Promise<{
      latitude: number;
      longitude: number;
    } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    });

    if (!coordinates) {
      setLocationState({
        fetching: false,
        isSuccess: false,
        status: triggeredByUser
          ? "Location access was denied or timed out."
          : "",
      });
      return;
    }

    try {
      let address = await reverseFromNominatim(
        coordinates.latitude,
        coordinates.longitude,
      );
      if (!address) {
        address = await reverseFromBigDataCloud(
          coordinates.latitude,
          coordinates.longitude,
        );
      }

      if (!address) {
        setLocationState({
          fetching: false,
          isSuccess: false,
          status: triggeredByUser
            ? "Could not resolve your address from GPS coordinates."
            : "",
        });
        return;
      }

      fillLocationFields(address);
      setLocationState({
        fetching: false,
        isSuccess: true,
        status: "Location fields updated from your current GPS position.",
      });
    } catch {
      setLocationState({
        fetching: false,
        isSuccess: false,
        status: triggeredByUser
          ? "Unable to fetch location details right now. Please retry."
          : "",
      });
    }
  };

  const handleMasonSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;

    const form = event.currentTarget;
    const formData = new FormData(form);
    if (phoneAvailability.exists) {
      setSubmitState({
        submitting: false,
        status: "Phone number is already registered.",
        isSuccess: false,
      });
      submitInFlightRef.current = false;
      return;
    }

    setSubmitState({
      submitting: true,
      status: "Submitting form...",
      isSuccess: false,
    });

    try {
      const idempotencyKey = `fs-${Date.now()}-${crypto.randomUUID()}`;
      const payload: Record<string, string | boolean> = {
        formType: "masonBarBender",
        isContacted: false,
        isApproved: false,
        isDeleted: false,
        isActive: true,
        isPending: true,
        isRejected: false,
      };
      formData.forEach((value, key) => {
        if (typeof value === "string" && FORM_FIELD_TO_BACKEND[key]) {
          const backendKey = FORM_FIELD_TO_BACKEND[key];
          if (!backendKey) return;
          if (backendKey === "sameAsAbove") {
            payload[backendKey] = value === "on";
            return;
          }
          payload[backendKey] = value;
        }
      });

      const submitFormData = new FormData();
      submitFormData.append("data", JSON.stringify(payload));

      const photoFile = formData.get("masonPhoto");
      const idProofFile = formData.get("masonIdProof");
      const idProofBackFile = formData.get("masonAddressProofBack");
      if (photoFile instanceof File && photoFile.size > 0) {
        submitFormData.append("photoProof", photoFile);
      }
      if (idProofFile instanceof File && idProofFile.size > 0) {
        submitFormData.append("idProof", idProofFile);
      }
      if (idProofBackFile instanceof File && idProofBackFile.size > 0) {
        submitFormData.append("idProofBack", idProofBackFile);
      }

      const registerResponse = await fetch(
        `${FORM_API_BASE}/form-submissions`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey,
          },
          body: submitFormData,
        },
      );

      const registerBody = (await registerResponse
        .json()
        .catch(() => null)) as unknown;
      if (!registerResponse.ok) {
        const message =
          extractApiMessage(registerBody) || "Unable to submit registration.";
        throw new Error(message);
      }

      setSubmitState({
        submitting: false,
        status: "Registration submitted successfully.",
        isSuccess: true,
      });
    } catch (error) {
      setSubmitState({
        submitting: false,
        status:
          error instanceof Error
            ? error.message
            : "Unable to submit registration. Please try again.",
        isSuccess: false,
      });
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const updateOtpState = (patch: Partial<OtpVerificationState>) => {
    setOtpState((previous) => ({
      ...previous,
      ...patch,
    }));
  };

  const handleOtpValueChange = (
    field: "phoneNumber" | "token",
    value: string,
  ) => {
    if (field === "phoneNumber") {
      if (isSameAsAbove) {
        setWhatsAppNumber(value);
      }
      setPhoneAvailability({
        checking: false,
        exists: false,
        status: "",
      });
    }
    updateOtpState({
      [field]: value,
      isValidated: false,
      status: "",
    });
  };

  const handleSendOtp = async () => {
    const phoneNumber = otpState.phoneNumber.trim().replace(/\D/g, "");
    const receiver =
      phoneNumber.length >= 10 ? phoneNumber.slice(-10) : phoneNumber;

    if (!receiver) {
      updateOtpState({ status: "Enter phone number before sending OTP." });
      return;
    }

    updateOtpState({
      checking: true,
      isValidated: false,
      status: "Sending OTP...",
    });

    try {
      const response = await fetch(`${FORM_API_BASE}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver }),
      });
      const responseBody = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          extractApiMessage(responseBody) ||
          "Unable to send OTP. Please try again.";
        throw new Error(message);
      }

      const ok = isRecord(responseBody) && responseBody.success === true;
      updateOtpState({
        checking: false,
        status: ok
          ? "OTP sent. Enter the validation code."
          : isRecord(responseBody) && typeof responseBody.message === "string"
            ? responseBody.message
            : "Unable to send OTP. Please try again.",
      });
    } catch (error) {
      updateOtpState({
        checking: false,
        status:
          error instanceof Error
            ? error.message
            : "Unable to send OTP. Please try again.",
      });
    }
  };

  const handleValidateOtp = async () => {
    const token = otpState.token.trim();
    const phoneNumber = otpState.phoneNumber.trim().replace(/\D/g, "");
    const receiver =
      phoneNumber.length >= 10 ? phoneNumber.slice(-10) : phoneNumber;

    if (!token) {
      updateOtpState({
        status: "Enter validation code before validating OTP.",
      });
      return;
    }

    if (!receiver) {
      updateOtpState({
        status: "Send OTP first (enter phone number and click Send OTP).",
      });
      return;
    }

    updateOtpState({ validating: true, status: "Validating OTP..." });

    try {
      const response = await fetch(`${FORM_API_BASE}/otp/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver, code: token }),
      });

      const responseBody = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          extractApiMessage(responseBody) || "OTP validation failed.";
        throw new Error(message);
      }

      const valid = isRecord(responseBody) && responseBody.valid === true;
      updateOtpState({
        validating: false,
        isValidated: valid,
        status: valid
          ? "OTP validated successfully."
          : extractApiMessage(responseBody) || "OTP validation failed.",
      });
    } catch (error) {
      updateOtpState({
        validating: false,
        isValidated: false,
        status:
          error instanceof Error ? error.message : "OTP validation failed.",
      });
    }
  };

  const setUploadInputRef =
    (key: UploadKey) => (element: HTMLInputElement | null) => {
      uploadInputRefs.current[key] = element;
    };

  const triggerUpload = (key: UploadKey) => {
    uploadInputRefs.current[key]?.click();
  };

  const setUploadFromFile = (key: UploadKey, selectedFile?: File) => {
    setUploadByKey((previous) => {
      const previousUrl = previous[key].previewUrl;
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      if (!selectedFile) {
        return {
          ...previous,
          [key]: { fileName: "", previewUrl: "" },
        };
      }

      return {
        ...previous,
        [key]: {
          fileName: selectedFile.name,
          previewUrl: URL.createObjectURL(selectedFile),
        },
      };
    });
  };

  const handleUploadChange = (
    key: UploadKey,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    setUploadFromFile(key, selectedFile);
  };

  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  };

  const openCameraModal = (key: UploadKey) => {
    if (!shouldUseModalCamera()) {
      triggerUpload(key);
      return;
    }

    setCameraFacingMode("environment");
    setCameraModal({
      isOpen: true,
      uploadKey: key,
      error: "",
      capturedFile: null,
      capturedPreviewUrl: "",
    });
  };

  const closeCameraModal = () => {
    if (cameraModal.capturedPreviewUrl) {
      URL.revokeObjectURL(cameraModal.capturedPreviewUrl);
    }

    stopCameraStream();
    setCameraModal({
      isOpen: false,
      uploadKey: null,
      error: "",
      capturedFile: null,
      capturedPreviewUrl: "",
    });
  };

  const toggleCameraFacingMode = () => {
    setCameraFacingMode((previous) =>
      previous === "environment" ? "user" : "environment",
    );
  };

  const captureCameraImage = async () => {
    if (!cameraModal.uploadKey) {
      return;
    }

    let blob: Blob | null = null;

    const videoTrack = cameraStreamRef.current?.getVideoTracks()[0];
    if (videoTrack && "ImageCapture" in window) {
      try {
        const IC = (window as unknown as Record<string, unknown>).ImageCapture as new (
          track: MediaStreamTrack,
        ) => { takePhoto: () => Promise<Blob> };
        const ic = new IC(videoTrack);
        blob = await ic.takePhoto();
      } catch {
        blob = null;
      }
    }

    if (!blob && cameraVideoRef.current) {
      const sourceVideo = cameraVideoRef.current;
      const targetCanvas = document.createElement("canvas");
      const width = sourceVideo.videoWidth || 720;
      const height = sourceVideo.videoHeight || 540;
      targetCanvas.width = width;
      targetCanvas.height = height;
      const drawingContext = targetCanvas.getContext("2d");
      if (!drawingContext) {
        setCameraModal((previous) => ({
          ...previous,
          error: "Unable to capture image. Please try again.",
        }));
        return;
      }
      drawingContext.drawImage(sourceVideo, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) =>
        targetCanvas.toBlob(resolve, "image/jpeg", 0.92),
      );
    }

    if (!blob || !cameraModal.uploadKey) {
      setCameraModal((previous) => ({
        ...previous,
        error: "Unable to capture image. Please try again.",
      }));
      return;
    }

    const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    const capturedPreviewUrl = URL.createObjectURL(capturedFile);

    setCameraModal((previous) => {
      if (previous.capturedPreviewUrl) {
        URL.revokeObjectURL(previous.capturedPreviewUrl);
      }
      return {
        ...previous,
        capturedFile,
        capturedPreviewUrl,
        error: "",
      };
    });
  };

  const clearCapturedCameraImage = () => {
    setCameraModal((previous) => {
      if (previous.capturedPreviewUrl) {
        URL.revokeObjectURL(previous.capturedPreviewUrl);
      }

      return {
        ...previous,
        capturedFile: null,
        capturedPreviewUrl: "",
        error: "",
      };
    });
  };

  const selectCapturedCameraImage = () => {
    if (!cameraModal.uploadKey || !cameraModal.capturedFile) {
      return;
    }

    setUploadFromFile(cameraModal.uploadKey, cameraModal.capturedFile);

    const inputElement = uploadInputRefs.current[cameraModal.uploadKey];
    if (inputElement) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(cameraModal.capturedFile);
      inputElement.files = dataTransfer.files;
    }

    closeCameraModal();
  };

  useEffect(() => {
    const normalizedPhone = normalizePhone(otpState.phoneNumber);
    if (phoneCheckTimerRef.current) {
      window.clearTimeout(phoneCheckTimerRef.current);
      phoneCheckTimerRef.current = null;
    }
    if (normalizedPhone.length !== 10) {
      setPhoneAvailability({
        checking: false,
        exists: false,
        status: "",
      });
      return;
    }

    setPhoneAvailability({
      checking: true,
      exists: false,
      status: "Checking phone number...",
    });
    phoneCheckTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `${FORM_API_BASE}/form-submissions/phone-status?phone=${encodeURIComponent(normalizedPhone)}`,
        );
        const responseBody = (await response
          .json()
          .catch(() => null)) as unknown;
        const exists =
          isRecord(responseBody) && typeof responseBody.exists === "boolean"
            ? responseBody.exists
            : false;
        setPhoneAvailability({
          checking: false,
          exists,
          status: exists ? "Phone number is already registered." : "",
        });
      } catch {
        setPhoneAvailability({
          checking: false,
          exists: false,
          status: "Unable to verify phone number right now.",
        });
      }
    }, 350);

    return () => {
      if (phoneCheckTimerRef.current) {
        window.clearTimeout(phoneCheckTimerRef.current);
        phoneCheckTimerRef.current = null;
      }
    };
  }, [otpState.phoneNumber]);

  const handleSameAsAboveChange = (checked: boolean) => {
    setIsSameAsAbove(checked);
    if (checked) {
      setWhatsAppNumber(otpState.phoneNumber);
    }
  };

  useEffect(() => {
    if (!cameraModal.isOpen) {
      return;
    }

    let isDisposed = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraModal((previous) => ({
          ...previous,
          error: "Camera is not supported on this browser.",
        }));
        return;
      }

      try {
        const videoConstraints: MediaTrackConstraints & Record<string, unknown> = {
          facingMode: { ideal: cameraFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };
        if (cameraFacingMode === "environment") {
          (videoConstraints as Record<string, unknown>).advanced = [
            { focusMode: "continuous" },
          ];
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        if (isDisposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && cameraFacingMode === "environment") {
          const caps = (videoTrack as unknown as { getCapabilities?: () => Record<string, unknown> })
            .getCapabilities?.();
          const supportedModes = caps?.focusMode;
          if (Array.isArray(supportedModes) && supportedModes.includes("continuous")) {
            await videoTrack
              .applyConstraints({
                advanced: [{ focusMode: "continuous" }],
              } as unknown as MediaTrackConstraints)
              .catch(() => undefined);
          }
        }

        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          await cameraVideoRef.current.play().catch(() => undefined);
        }

        setCameraModal((previous) => ({
          ...previous,
          error: "",
        }));
      } catch {
        setCameraModal((previous) => ({
          ...previous,
          error: "Unable to access camera. Allow permission and retry.",
        }));
      }
    };

    startCamera();

    return () => {
      isDisposed = true;
      stopCameraStream();
    };
  }, [cameraModal.isOpen, cameraFacingMode]);

  useEffect(() => {
    if (!cameraModal.isOpen || cameraModal.capturedPreviewUrl) {
      return;
    }

    const currentStream = cameraStreamRef.current;
    if (!currentStream || !cameraVideoRef.current) {
      return;
    }

    // Avoid replaying immediately after initial open; only rebind stream when needed.
    if (cameraVideoRef.current.srcObject !== currentStream) {
      cameraVideoRef.current.srcObject = currentStream;
    }
  }, [cameraModal.isOpen, cameraModal.capturedPreviewUrl]);

  useEffect(() => {
    fetchAndFillLocation(false);
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setViewportWidth(window.innerWidth);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const clearUpload = (key: UploadKey) => {
    const inputElement = uploadInputRefs.current[key];
    if (inputElement) {
      inputElement.value = "";
    }

    setUploadFromFile(key);
  };

  const renderCameraModal = () => {
    if (!cameraModal.isOpen) {
      return null;
    }

    return (
      <div style={cameraOverlayStyle}>
        <div style={cameraDialogStyle}>
          <div style={cameraDialogHeaderStyle}>
            <div>
              <h3 style={cameraTitleStyle}>Capture Photo</h3>
              <p style={cameraSubtitleStyle}>
                Place your face/document in frame and capture clearly.
              </p>
            </div>
            <div style={cameraHeaderActionsStyle}>
              <button
                type="button"
                onClick={toggleCameraFacingMode}
                style={cameraSwitchButtonStyle}
              >
                {cameraFacingMode === "environment"
                  ? "Switch to Front"
                  : "Switch to Back"}
              </button>
              <button
                type="button"
                onClick={closeCameraModal}
                style={cameraCloseButtonStyle}
              >
                ×
              </button>
            </div>
          </div>
          <div style={cameraViewportStyle}>
            {cameraModal.capturedPreviewUrl ? (
              <img
                src={cameraModal.capturedPreviewUrl}
                alt="Captured preview"
                style={cameraVideoStyle}
              />
            ) : (
              <video
                ref={cameraVideoRef}
                autoPlay
                muted
                playsInline
                style={cameraVideoStyle}
              />
            )}
          </div>
          {cameraModal.error && (
            <p style={cameraErrorStyle}>{cameraModal.error}</p>
          )}
          {!cameraModal.error && !cameraModal.capturedPreviewUrl && (
            <p style={cameraHintStyle}>
              Tip: Keep the phone steady and ensure proper lighting.
            </p>
          )}
          <div style={cameraFooterStyle}>
            {cameraModal.capturedPreviewUrl ? (
              <>
                <button
                  type="button"
                  style={{
                    ...cameraClearButtonStyle,
                    width: isMobile ? "100%" : "auto",
                  }}
                  onClick={clearCapturedCameraImage}
                >
                  Retake
                </button>
                <button
                  type="button"
                  style={{
                    ...cameraCaptureButtonStyle,
                    width: isMobile ? "100%" : "auto",
                  }}
                  onClick={selectCapturedCameraImage}
                >
                  Use Photo
                </button>
              </>
            ) : (
              <button
                type="button"
                style={{
                  ...cameraCaptureButtonStyle,
                  width: isMobile ? "100%" : "auto",
                }}
                onClick={captureCameraImage}
              >
                Capture
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <main
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #f4f6fb 0%, #e8edf7 100%)",
          padding: isMobile ? "14px 10px 28px" : "30px 20px 56px",
          fontFamily: "Segoe UI, sans-serif",
          color: "#0f172a",
        }}
      >
        <section style={sectionStyle}>
          <header
            style={{
              textAlign: "center",
              marginBottom: isMobile ? 18 : 28,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: isMobile ? 26 : 42,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              Masons & Barbenders Registration
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: isMobile ? 14 : 20,
                fontWeight: 600,
                color: "#344054",
              }}
            >
              Passport To Progress Application Form 2024
            </p>
          </header>

          <form ref={formRef} onSubmit={handleMasonSubmit}>
            <SectionTitle title="PERSONAL INFORMATION" />
            <div style={responsiveGridTwo}>
              <input
                name="firstName"
                placeholder="First Name"
                style={fieldStyle}
              />
              <input
                name="lastName"
                placeholder="Last Name"
                style={fieldStyle}
              />
            </div>
            <div style={responsiveGridTwo}>
              <select name="profession" style={fieldStyle} defaultValue="Mason">
                <option>Mason</option>
                <option>BarBender</option>
              </select>
              <div style={dateInputWrapperStyle}>
                <ThemedDatePickerInput
                  name="dateOfBirth"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  max={todayDate}
                />
              </div>
            </div>

            <div style={responsiveGridTwo}>
              <input
                name="phoneNumber"
                placeholder="Phone Number*"
                style={fieldStyle}
                required
                value={otpState.phoneNumber}
                onChange={(event) =>
                  handleOtpValueChange("phoneNumber", event.target.value)
                }
              />
              {canShowOtpControls && (
                <div
                  style={{
                    display: "flex",
                    alignItems: isMobile ? "stretch" : "center",
                    justifyContent: "flex-start",
                    gap: 12,
                    flexDirection: isMobile ? "column" : "row",
                  }}
                >
                  <button
                    type="button"
                    style={{
                      ...smallRedButtonStyle,
                      width: isMobile ? "100%" : "auto",
                      minHeight: 40,
                    }}
                    onClick={handleSendOtp}
                    disabled={otpState.checking}
                  >
                    {otpState.checking ? "Sending..." : "Send OTP"}
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    (OTP for SK Customer verification)
                  </span>
                </div>
              )}
            </div>

            {canShowOtpControls && (
              <div style={responsiveOtpGrid}>
                <input
                  name="validationCode"
                  placeholder="Enter Validation Code"
                  style={fieldStyle}
                  value={otpState.token}
                  onChange={(event) =>
                    handleOtpValueChange("token", event.target.value)
                  }
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                  }}
                >
                  <button
                    type="button"
                    style={{
                      ...smallRedButtonStyle,
                      width: isMobile ? "100%" : "auto",
                      minHeight: 40,
                    }}
                    onClick={handleValidateOtp}
                    disabled={otpState.validating}
                  >
                    {otpState.validating ? "Validating..." : "Validate OTP"}
                  </button>
                </div>
              </div>
            )}
            {canShowOtpControls && otpState.status && (
              <p
                style={{
                  ...otpStatusStyle,
                  color: otpState.isValidated ? "#0f8a3c" : "#b42318",
                }}
              >
                {otpState.status}
              </p>
            )}
            {phoneAvailability.status && (
              <p
                style={{
                  ...otpStatusStyle,
                  color: phoneAvailability.checking
                    ? "#175cd3"
                    : phoneAvailability.exists
                      ? "#b42318"
                      : "#0f8a3c",
                }}
              >
                {phoneAvailability.status}
              </p>
            )}

            <div style={responsiveGridTwo}>
              <input
                name="whatsappNumber"
                placeholder="WhatsApp Number"
                style={fieldStyle}
                value={whatsAppNumber}
                onChange={(event) => setWhatsAppNumber(event.target.value)}
              />
              <input name="emailId" placeholder="Email ID" style={fieldStyle} />
            </div>

            <label style={checkboxLineStyle}>
              <input
                type="checkbox"
                name="sameAsAbove"
                checked={isSameAsAbove}
                onChange={(event) =>
                  handleSameAsAboveChange(event.target.checked)
                }
              />
              <span>Same as above</span>
            </label>

            <SectionTitle title="PERMANENT ADDRESS" />
            <div style={addressStackStyle}>
              <input
                name="addressLine1"
                placeholder="Address Line 1*"
                style={fieldStyle}
              />
              <input
                name="addressLine2"
                placeholder="Address Line 2"
                style={fieldStyle}
              />
            </div>
            <div style={responsiveGridTwo}>
              <input name="taluk" placeholder="Taluk" style={fieldStyle} />
              <input
                name="district"
                placeholder="District*"
                style={fieldStyle}
              />
            </div>
            <div style={responsiveGridTwo}>
              <input name="city" placeholder="City*" style={fieldStyle} />
              <select name="state" style={fieldStyle} defaultValue="Karnataka">
                <option>Karnataka</option>
                <option>Tamil Nadu</option>
                <option>Kerala</option>
                <option>Andhra Pradesh</option>
              </select>
            </div>
            <div style={responsiveGridTwo}>
              <input name="pincode" placeholder="Pincode*" style={fieldStyle} />
              <input
                name="landmark"
                placeholder="Landmark"
                style={fieldStyle}
              />
            </div>

            <SectionTitle title="CURRENT LOCATION" />
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                style={{
                  ...smallRedButtonStyle,
                  width: isMobile ? "100%" : "auto",
                }}
                onClick={() => fetchAndFillLocation(true)}
                disabled={locationState.fetching}
              >
                {locationState.fetching
                  ? "Getting Location..."
                  : "Use Current Location"}
              </button>
              {locationState.status && (
                <p
                  style={{
                    ...otpStatusStyle,
                    marginTop: 8,
                    color: locationState.isSuccess ? "#0f8a3c" : "#b42318",
                  }}
                >
                  {locationState.status}
                </p>
              )}
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="currentAddress1"
                placeholder="Address 1"
                style={fieldStyle}
              />
              <input
                name="currentAddress2"
                placeholder="Address 2"
                style={fieldStyle}
              />
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="currentDistrict"
                placeholder="District"
                style={fieldStyle}
              />
              <input
                name="currentTaluk"
                placeholder="Taluk"
                style={fieldStyle}
              />
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="currentCityTown"
                placeholder="City/Town"
                style={fieldStyle}
              />
              <input
                name="currentPincode"
                placeholder="Enter Pincode"
                style={fieldStyle}
              />
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="currentLandmark"
                placeholder="Landmark"
                style={fieldStyle}
              />
              <div />
            </div>

            <SectionTitle title="SALES OFFICER DETAILS" />
            <div style={responsiveGridTwo}>
              <input
                name="salesOfficerName"
                placeholder="Name Of The Person*"
                style={fieldStyle}
              />
              <input
                name="salesOfficerContact"
                placeholder="Contact No*"
                style={fieldStyle}
              />
            </div>

            <SectionTitle title="REPORTING MANAGER DETAILS" />
            <div style={responsiveGridTwo}>
              <input
                name="reportingManagerName"
                placeholder="Reporting Manager"
                style={fieldStyle}
              />
              <div />
            </div>

            <SectionTitle title="DEALER DETAILS" />
            <div style={responsiveGridTwo}>
              <input
                name="dealerName"
                placeholder="Name Of The Dealer*"
                style={fieldStyle}
              />
              <input
                name="dealerPlace"
                placeholder="Place*"
                style={fieldStyle}
              />
            </div>

            <SectionTitle title="UPLOAD" />
            <div style={responsiveUploadGrid}>
              <UploadInputCard
                title="Photograph*"
                subtitle="Please Capture / Upload your photograph here"
                inputName="masonPhoto"
                upload={uploadByKey.masonPhoto}
                captureMode
                onTrigger={() => triggerUpload("masonPhoto")}
                onClear={() => clearUpload("masonPhoto")}
                onFileChange={(event) =>
                  handleUploadChange("masonPhoto", event)
                }
                inputRef={setUploadInputRef("masonPhoto")}
              />
              <UploadInputCard
                title="ID Proof*"
                subtitle="Any ID Proof"
                inputName="masonIdProof"
                upload={uploadByKey.masonIdProof}
                onTrigger={() => triggerUpload("masonIdProof")}
                onClear={() => clearUpload("masonIdProof")}
                onFileChange={(event) =>
                  handleUploadChange("masonIdProof", event)
                }
                inputRef={setUploadInputRef("masonIdProof")}
              />
              <UploadInputCard
                title="Address Proof - Back Side"
                subtitle="Any ID Proof"
                inputName="masonAddressProofBack"
                upload={uploadByKey.masonAddressProofBack}
                onTrigger={() => triggerUpload("masonAddressProofBack")}
                onClear={() => clearUpload("masonAddressProofBack")}
                onFileChange={(event) =>
                  handleUploadChange("masonAddressProofBack", event)
                }
                inputRef={setUploadInputRef("masonAddressProofBack")}
              />
            </div>

            <SectionTitle title="DECLARATION" />
            {submitState.status && (
              <p
                style={{
                  ...otpStatusStyle,
                  color: submitState.isSuccess ? "#0f8a3c" : "#b42318",
                }}
              >
                {submitState.status}
              </p>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: isMobile ? "stretch" : "flex-end",
                flexDirection: isMobile ? "column" : "row",
                gap: 16,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <div style={declarationChoiceContainerStyle}>
                <input
                  type="hidden"
                  name="agree"
                  value={declarationChoice === "agree" ? "true" : "false"}
                />
                <input
                  type="hidden"
                  name="disagree"
                  value={declarationChoice === "disagree" ? "true" : "false"}
                />

                <button
                  type="button"
                  aria-pressed={declarationChoice === "agree"}
                  style={{
                    ...declarationChoiceButtonStyle,
                    ...(declarationChoice === "agree"
                      ? declarationChoiceButtonSelectedStyle
                      : {}),
                  }}
                  onClick={() => setDeclarationChoice("agree")}
                >
                  I Agree
                </button>
                <button
                  type="button"
                  aria-pressed={declarationChoice === "disagree"}
                  style={{
                    ...declarationChoiceButtonStyle,
                    ...(declarationChoice === "disagree"
                      ? declarationChoiceButtonSelectedStyle
                      : {}),
                  }}
                  onClick={() => setDeclarationChoice("disagree")}
                >
                  I don&apos;t Agree
                </button>
              </div>

              {declarationChoice === "agree" && (
                <button
                  type="submit"
                  disabled={
                    submitState.submitting ||
                    phoneAvailability.checking ||
                    phoneAvailability.exists
                  }
                  style={submitButtonStyle}
                >
                  {submitState.submitting ? "Submitting..." : "Submit"}
                </button>
              )}
            </div>
          </form>
        </section>
        {renderCameraModal()}
      </main>
    </>
  );
}

function extractApiMessage(responseBody: unknown): string {
  if (!isRecord(responseBody)) {
    return "";
  }

  const candidates = [
    responseBody.message,
    responseBody.error,
    responseBody.statusMessage,
    isRecord(responseBody.data) ? responseBody.data.message : undefined,
    isRecord(responseBody.result) ? responseBody.result.message : undefined,
  ];

  const message = candidates.find(
    (value) => typeof value === "string" && value.trim(),
  );
  return typeof message === "string" ? message : "";
}

function extractOtpMeta(responseBody: unknown): {
  txId: string;
  timeStamp: number;
} {
  if (!isRecord(responseBody)) {
    return {
      txId: "",
      timeStamp: Date.now(),
    };
  }

  const responseData = isRecord(responseBody.data) ? responseBody.data : {};
  const responseResult = isRecord(responseBody.result)
    ? responseBody.result
    : {};

  const txIdCandidates = [
    responseBody.txId,
    responseBody.TxId,
    responseData.txId,
    responseData.TxId,
    responseResult.txId,
    responseResult.TxId,
  ];
  const txIdValue = txIdCandidates.find(
    (value) => typeof value === "string" && value.trim(),
  );
  const txId = typeof txIdValue === "string" ? txIdValue : "";

  const timeStampCandidates = [
    responseBody.timeStamp,
    responseBody.timestamp,
    responseBody.TimeStamp,
    responseData.timeStamp,
    responseData.timestamp,
    responseResult.timeStamp,
    responseResult.timestamp,
  ];

  const timeStampNumber = timeStampCandidates
    .map((value) => {
      if (typeof value === "number") {
        return value;
      }

      if (typeof value === "string") {
        return Number(value);
      }

      return Number.NaN;
    })
    .find((value) => Number.isFinite(value));

  return {
    txId,
    timeStamp:
      typeof timeStampNumber === "number" ? timeStampNumber : Date.now(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseIsoDate(value: string): Date | null {
  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string): string {
  const parsedDate = parseIsoDate(value);
  if (!parsedDate) {
    return "";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isSameDate(firstDate: Date, secondDate: Date): boolean {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

type ThemedDatePickerInputProps = {
  name: string;
  value: string;
  max: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
};

function ThemedDatePickerInput({
  name,
  value,
  max,
  onChange,
  placeholder = "Date of Birth",
}: ThemedDatePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openPickerMenu, setOpenPickerMenu] = useState<"month" | "year" | null>(
    null,
  );
  const parsedValue = parseIsoDate(value);
  const maxDate = parseIsoDate(max) || new Date();
  const minYear = 1940;
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const sourceDate = parsedValue || maxDate;
    return new Date(sourceDate.getFullYear(), sourceDate.getMonth(), 1);
  });
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const sourceDate = parsedValue || maxDate;
    setVisibleMonth(
      new Date(sourceDate.getFullYear(), sourceDate.getMonth(), 1),
    );
  }, [value, isOpen]);

  const monthOptions = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const yearOptions = Array.from(
    { length: Math.max(maxDate.getFullYear() - minYear + 1, 1) },
    (_, index) => maxDate.getFullYear() - index,
  );

  const monthStartDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  ).getDay();
  const totalDays = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const dayCells = [
    ...Array(monthStartDay).fill(null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
  const maxMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const canGoNextMonth = visibleMonth < maxMonthStart;

  const moveMonth = (offset: number) => {
    setOpenPickerMenu(null);
    setVisibleMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + offset,
          1,
        ),
    );
  };

  const handleMonthChange = (nextMonth: number) => {
    const currentYear = visibleMonth.getFullYear();
    const clampedMonth =
      currentYear === maxDate.getFullYear()
        ? Math.min(nextMonth, maxDate.getMonth())
        : nextMonth;
    setVisibleMonth(new Date(currentYear, clampedMonth, 1));
    setOpenPickerMenu(null);
  };

  const handleYearChange = (nextYear: number) => {
    const currentMonth = visibleMonth.getMonth();
    const clampedMonth =
      nextYear === maxDate.getFullYear()
        ? Math.min(currentMonth, maxDate.getMonth())
        : currentMonth;
    setVisibleMonth(new Date(nextYear, clampedMonth, 1));
    setOpenPickerMenu(null);
  };

  const handleSelectDay = (dayNumber: number) => {
    const selectedDate = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      dayNumber,
    );
    if (selectedDate > maxDate) {
      return;
    }

    onChange(formatIsoDate(selectedDate));
    setOpenPickerMenu(null);
    setIsOpen(false);
  };

  return (
    <div style={customDatePickerWrapStyle} ref={pickerRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        style={customDateTriggerStyle}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <span style={{ color: value ? "#1d2939" : "#667085" }}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <span style={customDateIconStyle}>📅</span>
      </button>

      {isOpen && (
        <div style={customDatePopoverStyle}>
          <div style={customDateHeaderStyle}>
            <button
              type="button"
              style={customDateNavButtonStyle}
              onClick={() => moveMonth(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div style={customDateSelectWrapStyle}>
              <div style={customDateSelectContainerStyle}>
                <button
                  type="button"
                  style={customDateSelectTriggerStyle}
                  onClick={() =>
                    setOpenPickerMenu((previous) =>
                      previous === "month" ? null : "month",
                    )
                  }
                  aria-label="Select month"
                >
                  <span>{monthOptions[visibleMonth.getMonth()]}</span>
                  <span style={customDateSelectChevronStyle}>▾</span>
                </button>
                {openPickerMenu === "month" && (
                  <div style={customDateDropdownMenuStyle}>
                    {monthOptions.map((monthName, monthIndex) => {
                      const isDisabled =
                        visibleMonth.getFullYear() === maxDate.getFullYear() &&
                        monthIndex > maxDate.getMonth();
                      const isActive = visibleMonth.getMonth() === monthIndex;

                      return (
                        <button
                          key={monthName}
                          type="button"
                          onClick={() => handleMonthChange(monthIndex)}
                          disabled={isDisabled}
                          style={{
                            ...customDateDropdownOptionStyle,
                            ...(isActive
                              ? customDateDropdownOptionActiveStyle
                              : {}),
                            ...(isDisabled
                              ? customDateDropdownOptionDisabledStyle
                              : {}),
                          }}
                        >
                          {monthName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={customDateSelectContainerStyle}>
                <button
                  type="button"
                  style={customDateSelectTriggerStyle}
                  onClick={() =>
                    setOpenPickerMenu((previous) =>
                      previous === "year" ? null : "year",
                    )
                  }
                  aria-label="Select year"
                >
                  <span>{visibleMonth.getFullYear()}</span>
                  <span style={customDateSelectChevronStyle}>▾</span>
                </button>
                {openPickerMenu === "year" && (
                  <div
                    style={{
                      ...customDateDropdownMenuStyle,
                      maxHeight: 210,
                    }}
                  >
                    {yearOptions.map((yearValue) => {
                      const isActive = visibleMonth.getFullYear() === yearValue;
                      return (
                        <button
                          key={yearValue}
                          type="button"
                          onClick={() => handleYearChange(yearValue)}
                          style={{
                            ...customDateDropdownOptionStyle,
                            ...(isActive
                              ? customDateDropdownOptionActiveStyle
                              : {}),
                          }}
                        >
                          {yearValue}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              style={{
                ...customDateNavButtonStyle,
                opacity: canGoNextMonth ? 1 : 0.45,
                cursor: canGoNextMonth ? "pointer" : "not-allowed",
              }}
              onClick={() => canGoNextMonth && moveMonth(1)}
              aria-label="Next month"
              disabled={!canGoNextMonth}
            >
              ›
            </button>
          </div>

          <div style={customDateWeekGridStyle}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
              <span key={label} style={customDateWeekdayStyle}>
                {label}
              </span>
            ))}
          </div>

          <div style={customDateDayGridStyle}>
            {dayCells.map((dayNumber, index) => {
              if (!dayNumber) {
                return <span key={`blank-${index}`} />;
              }

              const cellDate = new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                dayNumber,
              );
              const isDisabled = cellDate > maxDate;
              const isSelected =
                !!parsedValue && isSameDate(cellDate, parsedValue);

              return (
                <button
                  key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${dayNumber}`}
                  type="button"
                  style={{
                    ...customDateDayButtonStyle,
                    ...(isSelected ? customDateDayButtonSelectedStyle : {}),
                    ...(isDisabled ? customDateDayButtonDisabledStyle : {}),
                  }}
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(dayNumber)}
                >
                  {dayNumber}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type UploadInputCardProps = {
  title: string;
  subtitle: string;
  inputName: string;
  upload: UploadPreviewState;
  onTrigger: () => void;
  onClear: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  inputRef: (element: HTMLInputElement | null) => void;
  captureMode?: boolean;
};

function UploadInputCard({
  title,
  subtitle,
  inputName,
  upload,
  onTrigger,
  onClear,
  onFileChange,
  inputRef,
  captureMode = false,
}: UploadInputCardProps) {
  return (
    <div style={uploadCardStyle}>
      <input
        ref={inputRef}
        name={inputName}
        type="file"
        accept=".jpg,.jpeg,.png,.gif"
        capture={captureMode ? "environment" : undefined}
        onChange={onFileChange}
        style={{ display: "none" }}
      />

      <p style={uploadTitleStyle}>{title}</p>
      <p style={uploadSubStyle}>{subtitle}</p>

      {!upload.previewUrl && (
        <div style={uploadActionRowStyle}>
          <button type="button" style={captureButtonStyle} onClick={onTrigger}>
            {captureMode ? "Capture Image" : "Choose File"}
          </button>
          <span style={uploadEmptyTextStyle}>
            {captureMode ? "No image captured" : "No file chosen"}
          </span>
        </div>
      )}

      {upload.previewUrl && (
        <div style={uploadPreviewRowStyle}>
          <img
            src={upload.previewUrl}
            alt={upload.fileName || "Uploaded preview"}
            style={uploadPreviewImageStyle}
          />
          <button
            type="button"
            onClick={onClear}
            style={removeUploadButtonStyle}
            aria-label="Remove uploaded file"
          >
            ×
          </button>
        </div>
      )}

      <p style={uploadHintStyle}>
        Accepted file types: .jpg, .jpeg, .png, .gif
      </p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3
      style={{
        background: "linear-gradient(90deg, #ffe665 0%, #ffe000 100%)",
        margin: "24px 0 14px",
        padding: "9px 12px",
        fontSize: 13,
        fontWeight: 700,
        width: "fit-content",
        minWidth: 250,
        borderRadius: 8,
        letterSpacing: 0.3,
      }}
    >
      {title}
    </h3>
  );
}

const gridTwo = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 14,
};

const fieldStyle = {
  width: "100%",
  minHeight: 46,
  border: "1px solid #d0d5dd",
  borderRadius: 10,
  backgroundColor: "#f8fafc",
  color: "#1d2939",
  padding: "10px 12px",
  fontSize: 14,
  boxSizing: "border-box" as const,
  outline: "none",
};

const addressStackStyle = {
  display: "grid",
  gap: 14,
  marginBottom: 14,
};

const dateInputWrapperStyle = {
  width: "100%",
  position: "relative" as const,
};

const customDatePickerWrapStyle = {
  position: "relative" as const,
  width: "100%",
};

const customDateTriggerStyle = {
  width: "100%",
  minHeight: 46,
  border: "1px solid #d0d5dd",
  borderRadius: 10,
  backgroundColor: "#f8fafc",
  color: "#1d2939",
  padding: "10px 12px",
  fontSize: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
};

const customDateIconStyle = {
  fontSize: 16,
  lineHeight: 1,
};

const customDatePopoverStyle = {
  position: "absolute" as const,
  top: "calc(100% + 8px)",
  left: 0,
  width: "100%",
  minWidth: 280,
  maxWidth: 360,
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: 12,
  boxShadow: "0 14px 34px rgba(16, 24, 40, 0.18)",
  padding: 12,
  zIndex: 12,
};

const customDateHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};

const customDateNavButtonStyle = {
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  borderRadius: 8,
  width: 32,
  height: 32,
  fontSize: 20,
  lineHeight: 1,
  color: "#344054",
  cursor: "pointer",
};

const customDateSelectWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const customDateSelectContainerStyle = {
  position: "relative" as const,
};

const customDateSelectTriggerStyle = {
  minWidth: 86,
  minHeight: 32,
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  backgroundColor: "#f8fafc",
  color: "#1d2939",
  padding: "4px 9px",
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  cursor: "pointer",
};

const customDateSelectChevronStyle = {
  fontSize: 11,
  color: "#667085",
};

const customDateDropdownMenuStyle = {
  position: "absolute" as const,
  top: "calc(100% + 6px)",
  left: 0,
  width: "100%",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: 10,
  boxShadow: "0 10px 24px rgba(16, 24, 40, 0.16)",
  padding: 4,
  display: "grid",
  gap: 2,
  maxHeight: 240,
  overflowY: "auto" as const,
  zIndex: 16,
};

const customDateDropdownOptionStyle = {
  border: "none",
  backgroundColor: "transparent",
  borderRadius: 8,
  minHeight: 30,
  padding: "6px 8px",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left" as const,
  color: "#1d2939",
  cursor: "pointer",
};

const customDateDropdownOptionActiveStyle = {
  backgroundColor: "#e8f1ff",
  color: "#0b4f94",
};

const customDateDropdownOptionDisabledStyle = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const customDateWeekGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  marginBottom: 8,
};

const customDateWeekdayStyle = {
  textAlign: "center" as const,
  fontSize: 12,
  fontWeight: 700,
  color: "#667085",
  padding: "4px 0",
};

const customDateDayGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
};

const customDateDayButtonStyle = {
  minHeight: 32,
  border: "none",
  backgroundColor: "#f9fafb",
  color: "#1d2939",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const customDateDayButtonSelectedStyle = {
  backgroundColor: "#1f78d1",
  color: "#ffffff",
};

const customDateDayButtonDisabledStyle = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const checkboxLineStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 14,
};

const declarationChoiceContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap" as const,
};

const declarationChoiceButtonStyle = {
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
  color: "#1d2939",
  borderRadius: 999,
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const declarationChoiceButtonSelectedStyle = {
  borderColor: "#1f78d1",
  backgroundColor: "#e8f1ff",
  color: "#0b4f94",
};

const otpGrid = {
  display: "grid",
  gridTemplateColumns: "1.2fr auto 1fr",
  gap: 14,
  alignItems: "center",
  marginBottom: 8,
};

const smallRedButtonStyle = {
  border: "none",
  backgroundColor: "#d11b1b",
  color: "#ffffff",
  padding: "10px 18px",
  fontWeight: 700,
  borderRadius: 10,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const otpStatusStyle = {
  margin: "4px 0 10px",
  fontSize: 13,
  fontWeight: 600,
};

const uploadGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 14,
};

const uploadCardStyle = {
  backgroundColor: "#f9fafb",
  borderRadius: 12,
  padding: 16,
  border: "1px solid #eaecf0",
};

const uploadTitleStyle = {
  margin: "0 0 6px",
  fontSize: 16,
  fontWeight: 700,
};

const uploadSubStyle = {
  margin: "0 0 10px",
  fontSize: 14,
  fontWeight: 600,
};

const uploadActionRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
};

const uploadEmptyTextStyle = {
  fontSize: 12,
  color: "#8b8b8b",
};

const uploadPreviewRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const uploadPreviewImageStyle = {
  width: 60,
  height: 60,
  objectFit: "cover" as const,
  borderRadius: 2,
  border: "1px solid #d9d9d9",
  backgroundColor: "#111111",
};

const removeUploadButtonStyle = {
  border: "none",
  backgroundColor: "transparent",
  color: "#888888",
  fontSize: 36,
  lineHeight: 1,
  cursor: "pointer",
};

const captureButtonStyle = {
  border: "none",
  backgroundColor: "#2f2f2f",
  color: "#ffffff",
  borderRadius: 8,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const cameraOverlayStyle = {
  position: "fixed" as const,
  inset: 0,
  backgroundColor: "rgba(2, 6, 23, 0.58)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 20,
};

const cameraDialogStyle = {
  width: "100%",
  maxWidth: 820,
  backgroundColor: "#ffffff",
  borderRadius: 16,
  boxShadow: "0 20px 45px rgba(2, 6, 23, 0.4)",
  overflow: "hidden" as const,
};

const cameraDialogHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: "16px 18px 12px",
  borderBottom: "1px solid #eaecf0",
};

const cameraTitleStyle = {
  margin: 0,
  fontSize: 24,
  fontWeight: 600,
  color: "#0f172a",
};

const cameraSubtitleStyle = {
  margin: "6px 0 0",
  fontSize: 13,
  fontWeight: 500,
  color: "#475467",
};

const cameraCloseButtonStyle = {
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  width: 36,
  height: 36,
  borderRadius: 10,
  fontSize: 26,
  lineHeight: 1,
  color: "#475467",
  cursor: "pointer",
};

const cameraHeaderActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const cameraSwitchButtonStyle = {
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
  color: "#344054",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const cameraViewportStyle = {
  padding: "14px 18px 0",
};

const cameraVideoStyle = {
  width: "100%",
  height: "min(68vh, 520px)",
  objectFit: "cover" as const,
  backgroundColor: "#111111",
  borderRadius: 12,
};

const cameraErrorStyle = {
  margin: "10px 18px 0",
  color: "#b42318",
  fontSize: 14,
  fontWeight: 600,
};

const cameraHintStyle = {
  margin: "10px 18px 0",
  color: "#475467",
  fontSize: 13,
  fontWeight: 500,
};

const cameraFooterStyle = {
  display: "flex",
  justifyContent: "center",
  flexWrap: "wrap" as const,
  gap: 10,
  padding: "14px 18px 18px",
};

const cameraCaptureButtonStyle = {
  border: "none",
  backgroundColor: "#1f78d1",
  color: "#ffffff",
  borderRadius: 10,
  padding: "10px 28px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  minWidth: 130,
};

const cameraClearButtonStyle = {
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#344054",
  borderRadius: 10,
  padding: "10px 28px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  minWidth: 130,
};

const uploadHintStyle = {
  margin: "10px 0 0",
  fontSize: 12,
  color: "#666666",
};

export default BarBendorsAndMasonsForm;
