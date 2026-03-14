import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

type UploadKey =
  | "masonPhoto"
  | "masonIdProof"
  | "masonAddressProofBack"
  | "masonPanCopy";

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
  txId: string;
  timeStamp: number | null;
  checking: boolean;
  validating: boolean;
  isValidated: boolean;
  status: string;
};

type SubmitState = {
  submitting: boolean;
  status: string;
  isSuccess: boolean;
};

type OfficePincodeLookupState = {
  loading: boolean;
  status: string;
  isSuccess: boolean;
};

const SK_BACKEND_URL = "https://sk-backend.emovur.com";

const createOtpState = (): OtpVerificationState => ({
  phoneNumber: "",
  token: "",
  txId: "",
  timeStamp: null,
  checking: false,
  validating: false,
  isValidated: false,
  status: "",
});

const createUploadState = (): Record<UploadKey, UploadPreviewState> => ({
  masonPhoto: { fileName: "", previewUrl: "" },
  masonIdProof: { fileName: "", previewUrl: "" },
  masonAddressProofBack: { fileName: "", previewUrl: "" },
  masonPanCopy: { fileName: "", previewUrl: "" },
});

function SkDealer() {
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
  const [officePincodeLookup, setOfficePincodeLookup] =
    useState<OfficePincodeLookupState>({
      loading: false,
      status: "",
      isSuccess: false,
    });
  const [formValidationError, setFormValidationError] = useState("");
  const [declarationChoice, setDeclarationChoice] = useState<
    "agree" | "disagree" | ""
  >("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const uploadInputRefs = useRef<Record<UploadKey, HTMLInputElement | null>>({
    masonPhoto: null,
    masonIdProof: null,
    masonAddressProofBack: null,
    masonPanCopy: null,
  });
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1100;
  const [spouseDob, setSpouseDob] = useState("");
  const [weddingDay, setWeddingDay] = useState("");
  const [childDob1, setChildDob1] = useState("");
  const [childDob2, setChildDob2] = useState("");
  const [childDob3, setChildDob3] = useState("");
  const todayDate = new Date().toISOString().split("T")[0];

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
    backgroundColor: "#d11b1b",
    color: "#ffffff",
    padding: isMobile ? "12px 20px" : "10px 34px",
    fontWeight: 700,
    borderRadius: 10,
    cursor: "pointer",
    opacity: submitState.submitting ? 0.8 : 1,
    width: isMobile ? "100%" : "auto",
    minWidth: isMobile ? "100%" : 140,
  };

  const shouldUseModalCamera = () => {
    return !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
  };

  const getFieldValue = (formData: FormData, key: string): string => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  const isValidIndianPhone = (value: string): boolean => /^\d{10}$/.test(value);
  const isValidIndianPincode = (value: string): boolean =>
    /^\d{6}$/.test(value);

  const getFormInputElement = (name: string): HTMLInputElement | null => {
    if (!formRef.current) {
      return null;
    }

    const targetElement = formRef.current.elements.namedItem(name);
    return targetElement instanceof HTMLInputElement ? targetElement : null;
  };

  const setFormInputValue = (name: string, value: string) => {
    const targetInput = getFormInputElement(name);
    if (!targetInput) {
      return;
    }

    targetInput.value = value;
  };

  const getAddressComponentValue = (
    components: Array<Record<string, unknown>>,
    typeName: string,
  ): string => {
    const component = components.find((item) => {
      const typeList = item.types;
      return (
        Array.isArray(typeList) &&
        typeList.some((typeValue) => typeValue === typeName)
      );
    });

    return component && typeof component.long_name === "string"
      ? component.long_name
      : "";
  };

  const handleOfficePincodeLookup = async (rawPincode: string) => {
    const pincode = rawPincode.trim();
    if (!pincode) {
      setOfficePincodeLookup({
        loading: false,
        status: "",
        isSuccess: false,
      });
      return;
    }

    if (!isValidIndianPincode(pincode)) {
      setOfficePincodeLookup({
        loading: false,
        status: "Enter a valid 6-digit pincode.",
        isSuccess: false,
      });
      return;
    }

    setOfficePincodeLookup({
      loading: true,
      status: "Fetching location from pincode...",
      isSuccess: false,
    });

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(pincode)}&key=AIzaSyDm7XyTys-cDc5ne0Poqhp1euERvFcMQGk`,
      );

      const responseBody = (await response.json().catch(() => null)) as unknown;
      if (!response.ok || !isRecord(responseBody)) {
        throw new Error("Unable to fetch location for this pincode.");
      }

      const apiStatus =
        typeof responseBody.status === "string" ? responseBody.status : "";
      if (apiStatus !== "OK") {
        throw new Error("No location found for this pincode.");
      }

      const results = Array.isArray(responseBody.results)
        ? responseBody.results
        : [];
      const firstResult = results[0];
      if (!isRecord(firstResult)) {
        throw new Error("Invalid location response for this pincode.");
      }

      const addressComponents = Array.isArray(firstResult.address_components)
        ? (firstResult.address_components.filter(isRecord) as Array<
            Record<string, unknown>
          >)
        : [];

      const cityTownValue =
        getAddressComponentValue(addressComponents, "locality") ||
        getAddressComponentValue(addressComponents, "postal_town") ||
        getAddressComponentValue(addressComponents, "sublocality_level_1") ||
        getAddressComponentValue(
          addressComponents,
          "administrative_area_level_3",
        );

      const districtValue =
        getAddressComponentValue(
          addressComponents,
          "administrative_area_level_2",
        ) ||
        getAddressComponentValue(
          addressComponents,
          "administrative_area_level_3",
        );

      const talukValue =
        getAddressComponentValue(
          addressComponents,
          "administrative_area_level_3",
        ) || getAddressComponentValue(addressComponents, "sublocality_level_1");

      const landmarkValue = getAddressComponentValue(
        addressComponents,
        "route",
      );

      if (cityTownValue) {
        setFormInputValue("shopCityTown", cityTownValue);
      }
      if (districtValue) {
        setFormInputValue("shopDistrict", districtValue);
      }
      if (talukValue) {
        setFormInputValue("shopTaluk", talukValue);
      }
      if (landmarkValue) {
        setFormInputValue("shopLandmark", landmarkValue);
      }

      setOfficePincodeLookup({
        loading: false,
        status: "Office location fields updated from pincode.",
        isSuccess: true,
      });
    } catch (error) {
      setOfficePincodeLookup({
        loading: false,
        status:
          error instanceof Error
            ? error.message
            : "Unable to fetch pincode details right now.",
        isSuccess: false,
      });
    }
  };

  const validateFormBeforeSubmit = (formData: FormData): string => {
    const requiredTextFields: Array<{ key: string; label: string }> = [
      { key: "dealershipName", label: "Dealership Name / Person Name" },
      { key: "officeAddressLine1", label: "Office Address Line 1" },
      { key: "city", label: "City" },
      { key: "postalCode", label: "Zip / Postal Code" },
      { key: "contactPerson", label: "Contact Person" },
      { key: "mobileNumber", label: "Mobile Number" },
      { key: "validationCode", label: "Validation Code" },
      { key: "emailId", label: "Email" },
      { key: "gstNumber", label: "GST Number" },
      { key: "shopAddress1", label: "Shop Address 1" },
      { key: "shopDistrict", label: "Shop District" },
      { key: "shopTaluk", label: "Shop Taluk" },
      { key: "shopCityTown", label: "Shop City/Town" },
      { key: "shopPincode", label: "Shop Pincode" },
      { key: "salesOfficerName", label: "Sales Officer Name" },
      {
        key: "salesOfficerContact",
        label: "Sales Officer Contact Number",
      },
    ];

    const missingField = requiredTextFields.find(
      ({ key }) => !getFieldValue(formData, key),
    );
    if (missingField) {
      return `${missingField.label} is required.`;
    }

    const phoneNumber = getFieldValue(formData, "mobileNumber");
    if (!isValidIndianPhone(phoneNumber)) {
      return "Mobile Number must be 10 digits.";
    }

    const salesOfficerContact = getFieldValue(formData, "salesOfficerContact");
    if (!isValidIndianPhone(salesOfficerContact)) {
      return "Sales Officer Contact Number must be 10 digits.";
    }

    const officePincode = getFieldValue(formData, "shopPincode");
    if (!isValidIndianPincode(officePincode)) {
      return "Shop Pincode must be 6 digits.";
    }

    if (!otpState.isValidated) {
      return "Please validate OTP before submitting the form.";
    }

    if (declarationChoice !== "agree") {
      return "Please agree to the declaration before submitting.";
    }

    const masonPhoto = formData.get("masonPhoto");
    const masonIdProof = formData.get("masonIdProof");

    if (!(masonPhoto instanceof File) || masonPhoto.size === 0) {
      return "Photograph is required.";
    }

    if (!(masonIdProof instanceof File) || masonIdProof.size === 0) {
      return "ID Proof is required.";
    }

    const masonAddressProofBack = formData.get("masonAddressProofBack");
    if (
      !(masonAddressProofBack instanceof File) ||
      masonAddressProofBack.size === 0
    ) {
      return "GST Certificate is required.";
    }

    return "";
  };

  const handleMasonSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setFormValidationError("");

    const validationError = validateFormBeforeSubmit(formData);
    if (validationError) {
      setSubmitState({
        submitting: false,
        status: validationError,
        isSuccess: false,
      });
      setFormValidationError(validationError);
      return;
    }

    setSubmitState({
      submitting: true,
      status: "Submitting form...",
      isSuccess: false,
    });

    try {
      const backendPayload = {
        formType: "form_d" as const,
        pi_firstName: getFieldValue(formData, "contactPerson") || getFieldValue(formData, "dealershipName"),
        pi_lastName: "",
        pi_profession: getFieldValue(formData, "ownershipType") || "Proprietor",
        pi_phone: getFieldValue(formData, "mobileNumber"),
        pi_emailId: getFieldValue(formData, "emailId") || undefined,
        pi_addressLane1: getFieldValue(formData, "officeAddressLine1"),
        pi_addressLane2: getFieldValue(formData, "officeAddressLine2") || undefined,
        pi_city: getFieldValue(formData, "city"),
        pi_state: getFieldValue(formData, "state"),
        pi_pincode: getFieldValue(formData, "postalCode") || undefined,
        ref_nameOfTheperson: getFieldValue(formData, "salesOfficerName"),
        ref_place: getFieldValue(formData, "salesOfficerContact"),
        shop_Address1: getFieldValue(formData, "shopAddress1"),
        shop_Address2: getFieldValue(formData, "shopAddress2") || undefined,
        shop_District: getFieldValue(formData, "shopDistrict") || undefined,
        shop_Taluk: getFieldValue(formData, "shopTaluk") || undefined,
        shop_City: getFieldValue(formData, "shopCityTown"),
        shop_Pincode: getFieldValue(formData, "shopPincode"),
        shop_Landmark: getFieldValue(formData, "shopLandmark") || undefined,
      };

      const submitFormData = new FormData();
      submitFormData.append("data", JSON.stringify(backendPayload));
      const masonPhotoFile = formData.get("masonPhoto");
      const masonIdProofFile = formData.get("masonIdProof");
      const masonAddressProofBackFile = formData.get("masonAddressProofBack");
      if (masonPhotoFile instanceof File && masonPhotoFile.size > 0) {
        submitFormData.append("photoProof", masonPhotoFile);
      }
      if (masonIdProofFile instanceof File && masonIdProofFile.size > 0) {
        submitFormData.append("idProof", masonIdProofFile);
      }
      if (masonAddressProofBackFile instanceof File && masonAddressProofBackFile.size > 0) {
        submitFormData.append("idProofBack", masonAddressProofBackFile);
      }

      const registerResponse = await fetch(
        `${SK_BACKEND_URL}/form-submissions`,
        {
          method: "POST",
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
        status:
          extractApiMessage(registerBody) ||
          "Registration submitted successfully.",
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
    updateOtpState({
      [field]: value,
      isValidated: false,
      status: "",
    });
    setFormValidationError("");
  };

  const handleSendOtp = async () => {
    const phoneNumber = otpState.phoneNumber.trim();

    if (!phoneNumber) {
      updateOtpState({ status: "Enter phone number before sending OTP." });
      return;
    }

    if (!isValidIndianPhone(phoneNumber)) {
      updateOtpState({ status: "Phone Number must be 10 digits." });
      return;
    }

    updateOtpState({
      checking: true,
      isValidated: false,
      status: "Sending OTP...",
    });

    try {
      const response = await fetch(
        `https://api.sksupertmt.com/api/Registration/CheckPhoneNumber?phoneNumber=${encodeURIComponent(phoneNumber)}`,
      );
      const responseBody = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          extractApiMessage(responseBody) ||
          "Unable to send OTP. Please try again.";
        throw new Error(message);
      }

      const otpMeta = extractOtpMeta(responseBody);
      updateOtpState({
        checking: false,
        txId: otpMeta.txId,
        timeStamp: otpMeta.timeStamp,
        status: "OTP sent. Enter the validation code.",
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

    if (!token) {
      updateOtpState({
        status: "Enter validation code before validating OTP.",
      });
      return;
    }

    if (!otpState.txId || !otpState.timeStamp) {
      updateOtpState({
        status: "Send OTP first to get txId and timestamp.",
      });
      return;
    }

    updateOtpState({ validating: true, status: "Validating OTP..." });

    try {
      const response = await fetch("https://sksupertmt.com/api/otp/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeStamp: otpState.timeStamp,
          token,
          txId: otpState.txId,
        }),
      });

      const responseBody = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          extractApiMessage(responseBody) || "OTP validation failed.";
        throw new Error(message);
      }

      updateOtpState({
        validating: false,
        isValidated: true,
        status:
          extractApiMessage(responseBody) || "OTP validated successfully.",
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

  const captureCameraImage = () => {
    if (!cameraModal.uploadKey || !cameraVideoRef.current) {
      return;
    }

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
    targetCanvas.toBlob(
      (blob) => {
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
      },
      "image/jpeg",
      0.92,
    );
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        if (isDisposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
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
  }, [cameraModal.isOpen]);

  useEffect(() => {
    if (!cameraModal.isOpen || cameraModal.capturedPreviewUrl) {
      return;
    }

    const currentStream = cameraStreamRef.current;
    if (!currentStream || !cameraVideoRef.current) {
      return;
    }

    cameraVideoRef.current.srcObject = currentStream;
    cameraVideoRef.current.play().catch(() => undefined);
  }, [cameraModal.isOpen, cameraModal.capturedPreviewUrl]);

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
            <button
              type="button"
              onClick={closeCameraModal}
              style={cameraCloseButtonStyle}
            >
              ×
            </button>
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
              Dealer Registration
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: isMobile ? 14 : 20,
                fontWeight: 600,
                color: "#344054",
              }}
            >
              Dealer Profile
            </p>
          </header>

          <form ref={formRef} onSubmit={handleMasonSubmit}>
            <SectionTitle title="PERSONAL INFORMATION" />
            <div style={addressStackStyle}>
              <input
                name="dealershipName"
                placeholder="DealerShip Name / Person Name*"
                style={fieldStyle}
                required
              />
              <input
                name="officeAddressLine1"
                placeholder="Office Address Line 1*"
                style={fieldStyle}
                required
              />
              <input
                name="officeAddressLine2"
                placeholder="Office Address Line 2"
                style={fieldStyle}
              />
            </div>

            <div
              style={{
                ...responsiveGridTwo,
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(3, minmax(0, 1fr))",
              }}
            >
              <input
                name="city"
                placeholder="City*"
                style={fieldStyle}
                required
              />
              <select name="state" style={fieldStyle} defaultValue="Karnataka">
                <option>Karnataka</option>
                <option>Tamil Nadu</option>
                <option>Kerala</option>
                <option>Andhra Pradesh</option>
              </select>
              <input
                name="postalCode"
                placeholder="Zip / Postal Code*"
                style={fieldStyle}
                required
              />
            </div>

            <div style={responsiveGridTwo}>
              <input
                name="contactPerson"
                placeholder="Contact Person*"
                style={fieldStyle}
                required
              />
              <input
                name="mobileNumber"
                placeholder="Mobile Number*"
                style={fieldStyle}
                required
                value={otpState.phoneNumber}
                onChange={(event) =>
                  handleOtpValueChange("phoneNumber", event.target.value)
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "flex-end",
                gap: 12,
                flexDirection: isMobile ? "column" : "row",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: isMobile ? "left" : "right",
                }}
              >
                OTP for SK Customer verification
              </span>
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
              </div>
            </div>

            <div style={responsiveGridTwo}>
              <div style={responsiveOtpGrid}>
                <input
                  name="validationCode"
                  placeholder="Enter Validation Code*"
                  style={fieldStyle}
                  required
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
              <input
                name="emailId"
                placeholder="Email"
                style={fieldStyle}
                required
              />
            </div>
            {otpState.status && (
              <p
                style={{
                  ...otpStatusStyle,
                  color: otpState.isValidated ? "#0f8a3c" : "#b42318",
                }}
              >
                {otpState.status}
              </p>
            )}

            <div style={responsiveGridTwo}>
              <input
                name="gstNumber"
                placeholder="GST Number*"
                style={fieldStyle}
                required
              />
              <input
                name="panNumber"
                placeholder="PAN Number"
                style={fieldStyle}
              />
            </div>

            <div style={responsiveGridTwo}>
              <select
                name="ownershipType"
                style={fieldStyle}
                defaultValue="Proprietor Ship"
              >
                <option>Proprietor Ship</option>
                <option>Partnership</option>
                <option>Private Limited</option>
              </select>
              <div />
            </div>

            <SectionTitle title="OWNER'S INFORMATION" />
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              Owner&apos;s Name (1)
            </p>
            <label style={{ ...checkboxLineStyle, marginBottom: 14 }}>
              <span style={{ fontWeight: 700 }}>Owner Details</span>
              <input type="checkbox" name="ownerSameAsAbove" />
              <span>Same as above</span>
            </label>

            <SectionTitle title="PERMANENT ADDRESS" />
            <div
              style={{
                ...responsiveGridTwo,
                gridTemplateColumns: isMobile ? "1fr" : "0.7fr 1fr 1fr",
              }}
            >
              <select name="ownerTitle" style={fieldStyle} defaultValue="Mr.">
                <option>Mr.</option>
                <option>Mrs.</option>
                <option>Ms.</option>
              </select>
              <input
                name="ownerFirstName"
                placeholder="First Name*"
                style={fieldStyle}
                required
              />
              <input
                name="ownerLastName"
                placeholder="Last Name"
                style={fieldStyle}
              />
            </div>
            <div style={addressStackStyle}>
              <input
                name="ownerOfficeAddressLine1"
                placeholder="Office Address line 1*"
                style={fieldStyle}
                required
              />
              <input
                name="ownerOfficeAddressLine2"
                placeholder="Office Address line 2"
                style={fieldStyle}
              />
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="ownerCity"
                placeholder="City*"
                style={fieldStyle}
                required
              />
              <select
                name="ownerState"
                style={fieldStyle}
                defaultValue="Karnataka"
              >
                <option>Karnataka</option>
                <option>Tamil Nadu</option>
                <option>Kerala</option>
                <option>Andhra Pradesh</option>
              </select>
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="ownerPostalCode"
                placeholder="Zip / Postal Code*"
                style={fieldStyle}
                required
              />
              <input
                name="ownerPlace"
                placeholder="Place ( Auto-Filled)*"
                style={fieldStyle}
                required
              />
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="ownerPhoneNumber"
                placeholder="Phone Number*"
                style={fieldStyle}
                required
              />
              <input
                name="ownerEmailId"
                placeholder="Email ID"
                style={fieldStyle}
              />
            </div>

            <p
              style={{
                margin: "6px 0 10px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              Second Contact Person
            </p>
            <div
              style={{
                ...responsiveGridTwo,
                gridTemplateColumns: isMobile ? "1fr" : "0.7fr 1fr 1fr",
              }}
            >
              <select
                name="secondContactTitle"
                style={fieldStyle}
                defaultValue="Mr."
              >
                <option>Mr.</option>
                <option>Mrs.</option>
                <option>Ms.</option>
              </select>
              <input
                name="secondContactFirstName"
                placeholder="First Name"
                style={fieldStyle}
              />
              <input
                name="secondContactLastName"
                placeholder="Last Name"
                style={fieldStyle}
              />
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="secondContactPhone"
                placeholder="Phone Number"
                style={fieldStyle}
              />
              <input
                name="secondContactEmail"
                placeholder="Email ID"
                style={fieldStyle}
              />
            </div>

            <p
              style={{
                margin: "6px 0 10px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              Greeting Information
            </p>
            <div
              style={{
                ...responsiveGridTwo,
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(3, minmax(0, 1fr))",
              }}
            >
              <input
                name="spouseName"
                placeholder="Spouse Name"
                style={fieldStyle}
              />
              <div style={dateInputWrapperStyle}>
                <ThemedDatePickerInput
                  name="spouseDob"
                  value={spouseDob}
                  onChange={setSpouseDob}
                  max={todayDate}
                  placeholder="Date of Birth"
                />
              </div>
              <div style={dateInputWrapperStyle}>
                <ThemedDatePickerInput
                  name="weddingDay"
                  value={weddingDay}
                  onChange={setWeddingDay}
                  max={todayDate}
                  placeholder="Wedding Day"
                />
              </div>
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="childName1"
                placeholder="Child's Name"
                style={fieldStyle}
              />
              <div style={dateInputWrapperStyle}>
                <ThemedDatePickerInput
                  name="childDob1"
                  value={childDob1}
                  onChange={setChildDob1}
                  max={todayDate}
                  placeholder="Date of Birth"
                />
              </div>
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="childName2"
                placeholder="Child's Name"
                style={fieldStyle}
              />
              <div style={dateInputWrapperStyle}>
                <ThemedDatePickerInput
                  name="childDob2"
                  value={childDob2}
                  onChange={setChildDob2}
                  max={todayDate}
                  placeholder="Date of Birth"
                />
              </div>
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="childName3"
                placeholder="Child's Name"
                style={fieldStyle}
              />
              <div style={dateInputWrapperStyle}>
                <ThemedDatePickerInput
                  name="childDob3"
                  value={childDob3}
                  onChange={setChildDob3}
                  max={todayDate}
                  placeholder="Date of Birth"
                />
              </div>
            </div>

            <SectionTitle title="DEPOT/GODOWN INFORMATION" />
            <label style={{ ...checkboxLineStyle, marginBottom: 14 }}>
              <span style={{ fontWeight: 700 }}>Depot/Godown Address</span>
              <input type="checkbox" name="godownSameAsCompany" />
              <span>Same as Company Address</span>
            </label>
            <div style={addressStackStyle}>
              <input
                name="godownAddressLine1"
                placeholder="Depot Address line 1*"
                style={fieldStyle}
                required
              />
              <input
                name="godownAddressLine2"
                placeholder="Depot Address line 2*"
                style={fieldStyle}
                required
              />
            </div>
            <div
              style={{
                ...responsiveGridTwo,
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(3, minmax(0, 1fr))",
              }}
            >
              <input
                name="godownCity"
                placeholder="City*"
                style={fieldStyle}
                required
              />
              <select
                name="godownState"
                style={fieldStyle}
                defaultValue="Karnataka"
              >
                <option>Karnataka</option>
                <option>Tamil Nadu</option>
                <option>Kerala</option>
                <option>Andhra Pradesh</option>
              </select>
              <input
                name="godownPostalCode"
                placeholder="Zip / Postal Code*"
                style={fieldStyle}
                required
              />
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="godownContactPerson"
                placeholder="Contact Person's Name"
                style={fieldStyle}
              />
              <input
                name="godownContactMobile"
                placeholder="Contact Person's Mobile Number"
                style={fieldStyle}
              />
            </div>

            <SectionTitle title="SHOP ADDRESS" />
            <div style={responsiveGridTwo}>
              <input
                name="shopAddress1"
                placeholder="Address 1"
                style={fieldStyle}
                required
              />
              <input
                name="shopAddress2"
                placeholder="Address 2"
                style={fieldStyle}
              />
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="shopDistrict"
                placeholder="District"
                style={fieldStyle}
                required
              />
              <input
                name="shopTaluk"
                placeholder="Taluk"
                style={fieldStyle}
                required
              />
            </div>
            <div style={responsiveGridTwo}>
              <input
                name="shopCityTown"
                placeholder="City/Town"
                style={fieldStyle}
                required
              />
              <input
                name="shopPincode"
                placeholder="Enter Pincode"
                style={fieldStyle}
                required
                onBlur={(event) =>
                  handleOfficePincodeLookup(event.target.value)
                }
              />
            </div>
            {officePincodeLookup.status && (
              <p
                style={{
                  ...otpStatusStyle,
                  color: officePincodeLookup.isSuccess ? "#0f8a3c" : "#b42318",
                }}
              >
                {officePincodeLookup.loading
                  ? "Fetching location from pincode..."
                  : officePincodeLookup.status}
              </p>
            )}
            <div style={responsiveGridTwo}>
              <input
                name="shopLandmark"
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
                required
              />
              <input
                name="salesOfficerContact"
                placeholder="Contact No*"
                style={fieldStyle}
                required
              />
            </div>

            <SectionTitle title="REFERENCES" />
            <div
              style={{
                ...responsiveGridTwo,
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(3, minmax(0, 1fr))",
              }}
            >
              <input
                name="referenceName1"
                placeholder="Name"
                style={fieldStyle}
              />
              <input
                name="referencePhone1"
                placeholder="Phone"
                style={fieldStyle}
              />
              <input
                name="referenceDetails1"
                placeholder="Details"
                style={fieldStyle}
              />
            </div>
            <div
              style={{
                ...responsiveGridTwo,
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(3, minmax(0, 1fr))",
              }}
            >
              <input
                name="referenceName2"
                placeholder="Name"
                style={fieldStyle}
              />
              <input
                name="referencePhone2"
                placeholder="Phone"
                style={fieldStyle}
              />
              <input
                name="referenceDetails2"
                placeholder="Details"
                style={fieldStyle}
              />
            </div>

            <SectionTitle title="UPLOAD" />
            <div style={responsiveUploadGrid}>
              <UploadInputCard
                title="ID Proof*"
                subtitle="Aadhar / Driving License / Voter ID"
                inputName="masonIdProof"
                upload={uploadByKey.masonIdProof}
                required
                onTrigger={() => triggerUpload("masonIdProof")}
                onClear={() => clearUpload("masonIdProof")}
                onFileChange={(event) =>
                  handleUploadChange("masonIdProof", event)
                }
                inputRef={setUploadInputRef("masonIdProof")}
              />
              <UploadInputCard
                title="GST Certificate*"
                subtitle="Any ID Proof"
                inputName="masonAddressProofBack"
                upload={uploadByKey.masonAddressProofBack}
                required
                onTrigger={() => triggerUpload("masonAddressProofBack")}
                onClear={() => clearUpload("masonAddressProofBack")}
                onFileChange={(event) =>
                  handleUploadChange("masonAddressProofBack", event)
                }
                inputRef={setUploadInputRef("masonAddressProofBack")}
              />
              <UploadInputCard
                title="PAN Card Copy"
                subtitle="Any ID Proof"
                inputName="masonPanCopy"
                upload={uploadByKey.masonPanCopy}
                onTrigger={() => triggerUpload("masonPanCopy")}
                onClear={() => clearUpload("masonPanCopy")}
                onFileChange={(event) =>
                  handleUploadChange("masonPanCopy", event)
                }
                inputRef={setUploadInputRef("masonPanCopy")}
              />
              <UploadInputCard
                title="Shop Photo - Front View*"
                subtitle="Photo of the Shop"
                inputName="masonPhoto"
                upload={uploadByKey.masonPhoto}
                captureMode
                required
                onTrigger={() => openCameraModal("masonPhoto")}
                onClear={() => clearUpload("masonPhoto")}
                onFileChange={(event) =>
                  handleUploadChange("masonPhoto", event)
                }
                inputRef={setUploadInputRef("masonPhoto")}
              />
            </div>

            <SectionTitle title="DECLARATION" />
            <p
              style={{
                margin: "4px 0 10px",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              TERMS &amp; CONDITIONS*
            </p>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.6,
                color: "#344054",
              }}
            >
              I herewith declare that I would like to enroll myself to the SK
              SUPER TMT Passport to Progress Program and herewith agree to all
              the terms and conditions of the scheme laid out by the company
              from time to time. I hereby permit SK SUPER TMT or its other
              companies to send me regular updates.
            </p>
            {formValidationError && (
              <p style={{ ...otpStatusStyle, color: "#b42318" }}>
                {formValidationError}
              </p>
            )}
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
                  I don't Agree
                </button>
              </div>

              {declarationChoice === "agree" && (
                <button
                  type="submit"
                  disabled={submitState.submitting}
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

  const parsedDate = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return parsedDate;
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
  required?: boolean;
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
  required = false,
}: UploadInputCardProps) {
  return (
    <div style={uploadCardStyle}>
      <input
        ref={inputRef}
        name={inputName}
        type="file"
        accept=".jpg,.jpeg,.png,.gif"
        required={required}
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
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "center",
  marginBottom: 0,
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

export default SkDealer;
