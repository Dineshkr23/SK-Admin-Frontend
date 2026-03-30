import { useEffect, useRef, useState, type FormEvent } from "react";

const GOOGLE_GEOCODE_KEY = "AIzaSyDm7XyTys-cDc5ne0Poqhp1euERvFcMQGk";
const SK_BACKEND_URL = "https://backend.sksupertmt.com";

function IndHouseForm() {
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window === "undefined" ? 1200 : window.innerWidth,
  );
  const [declarationChoice, setDeclarationChoice] = useState<
    "agree" | "disagree" | ""
  >("");
  const [currentPincode, setCurrentPincode] = useState("");
  const [siteLocationStatus, setSiteLocationStatus] = useState("");
  const [siteLocationLoading, setSiteLocationLoading] = useState(false);
  const [shopLocation, setShopLocation] = useState("Latitude: , Longitude: ");
  const [submitState, setSubmitState] = useState({
    submitting: false,
    status: "",
    isSuccess: false,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [invalidFieldName, setInvalidFieldName] = useState("");
  const [talukOptions, setTalukOptions] = useState<string[]>([]);
  const [selectedTaluk, setSelectedTaluk] = useState("");
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [isSameAsAbove, setIsSameAsAbove] = useState(false);
  const [phoneNumberInput, setPhoneNumberInput] = useState("");
  const [phoneAvailability, setPhoneAvailability] = useState({
    checking: false,
    exists: false,
    status: "",
  });
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastResolvedPincodeRef = useRef("");
  const submitInFlightRef = useRef(false);
  const phoneCheckTimerRef = useRef<number | null>(null);

  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1100;

  const responsiveGridTwo = {
    ...gridTwo,
    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
  };

  const responsiveGridThree = {
    ...gridThree,
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

  useEffect(() => {
    const normalizedPincode = currentPincode.replace(/\D/g, "");

    if (normalizedPincode.length !== 6) {
      if (!normalizedPincode) {
        setSiteLocationStatus("");
      }
      setTalukOptions([]);
      setSelectedTaluk("");
      setSiteLocationLoading(false);
      return;
    }

    if (lastResolvedPincodeRef.current === normalizedPincode) {
      return;
    }

    const lookupTimer = window.setTimeout(async () => {
      setSiteLocationLoading(true);
      setSiteLocationStatus("Fetching location from pincode...");

      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(normalizedPincode)}&key=${encodeURIComponent(
            GOOGLE_GEOCODE_KEY,
          )}`,
        );

        const responseBody = (await response
          .json()
          .catch(() => null)) as unknown;
        if (!response.ok || !isRecord(responseBody)) {
          throw new Error("Unable to fetch location for this pincode.");
        }

        if (responseBody.status !== "OK") {
          throw new Error("No location found for this pincode.");
        }

        const results = Array.isArray(responseBody.results)
          ? responseBody.results
          : [];
        const firstResult = results[0];
        if (!isRecord(firstResult)) {
          throw new Error("No location found for this pincode.");
        }

        const addressComponents = Array.isArray(firstResult.address_components)
          ? firstResult.address_components
          : [];

        const getByType = (...targetTypes: string[]) => {
          const matchedComponent = addressComponents.find((component) => {
            if (!isRecord(component) || !Array.isArray(component.types)) {
              return false;
            }

            const componentTypes = component.types.filter(
              (typeItem): typeItem is string => typeof typeItem === "string",
            );

            return targetTypes.some((targetType) =>
              componentTypes.includes(targetType),
            );
          });

          return isRecord(matchedComponent) &&
            typeof matchedComponent.long_name === "string"
            ? matchedComponent.long_name
            : "";
        };

        const cityTown = getByType(
          "locality",
          "postal_town",
          "administrative_area_level_3",
        );
        const district = getByType(
          "administrative_area_level_2",
          "administrative_area_level_3",
        );
        const formattedAddress =
          typeof firstResult.formatted_address === "string"
            ? firstResult.formatted_address
            : "";
        const geometry = isRecord(firstResult.geometry)
          ? firstResult.geometry
          : null;
        const location =
          geometry && isRecord(geometry.location) ? geometry.location : null;
        const latitude =
          location && typeof location.lat === "number" ? location.lat : null;
        const longitude =
          location && typeof location.lng === "number" ? location.lng : null;
        const postcodeLocalities = Array.isArray(
          firstResult.postcode_localities,
        )
          ? firstResult.postcode_localities.filter(
              (locality): locality is string =>
                typeof locality === "string" && locality.trim().length > 0,
            )
          : [];

        const talukFromResponse =
          postcodeLocalities[0] || cityTown || district || "";
        const cleanAddressLine1 = formattedAddress
          .replace(/,\s*India\s*$/i, "")
          .trim();

        if (formRef.current) {
          const setNamedField = (fieldName: string, fieldValue: string) => {
            const fieldElement = formRef.current?.elements.namedItem(fieldName);
            if (
              !fieldElement ||
              !(
                fieldElement instanceof HTMLInputElement ||
                fieldElement instanceof HTMLSelectElement
              )
            ) {
              return;
            }

            fieldElement.value = fieldValue;
          };

          // Fill site location only - do NOT prefill permanent address (state)
          setNamedField("currentAddress1", cleanAddressLine1);
          setNamedField("currentAddress2", "");
          setNamedField("currentCityTown", cityTown);
          setNamedField("currentDistrict", district);
          setNamedField(
            "currentLandmark",
            district || cityTown || cleanAddressLine1,
          );
        }

        setTalukOptions(postcodeLocalities);
        setSelectedTaluk(talukFromResponse);
        setShopLocation(
          `Latitude: ${latitude === null ? "" : String(latitude)}, Longitude: ${longitude === null ? "" : String(longitude)}`,
        );

        setSiteLocationLoading(false);
        setSiteLocationStatus("Site location fields updated from pincode.");
        lastResolvedPincodeRef.current = normalizedPincode;
      } catch (error) {
        setTalukOptions([]);
        setSelectedTaluk("");
        setShopLocation("Latitude: , Longitude: ");
        setSiteLocationLoading(false);
        setSiteLocationStatus(
          error instanceof Error
            ? error.message
            : "Unable to fetch location for this pincode.",
        );
      }
    }, 350);

    return () => {
      window.clearTimeout(lookupTimer);
    };
  }, [currentPincode]);

  const focusAndScrollToField = (fieldName: string) => {
    setInvalidFieldName(fieldName);
    const fieldElement = formRef.current?.elements.namedItem(fieldName);
    if (
      !(
        fieldElement instanceof HTMLInputElement ||
        fieldElement instanceof HTMLSelectElement ||
        fieldElement instanceof HTMLTextAreaElement
      )
    ) {
      return;
    }

    fieldElement.focus();
    fieldElement.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const getFieldStyleWithError = (fieldName: string) => {
    if (invalidFieldName !== fieldName) {
      return fieldStyle;
    }

    return {
      ...fieldStyle,
      ...invalidFieldStyle,
    };
  };

  const setValidationError = (fieldName: string, message: string) => {
    setFieldErrors({ [fieldName]: message });
    focusAndScrollToField(fieldName);
  };
  const normalizePhone = (value: string): string => value.replace(/\D/g, "").slice(-10);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;
    setFieldErrors({});
    setInvalidFieldName("");

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    const getValue = (key: string) => {
      const rawValue = formData.get(key);
      return typeof rawValue === "string" ? rawValue.trim() : "";
    };

    const payload = {
      honorifics: getValue("title"),
      firstName: getValue("firstName"),
      lastName: getValue("lastName"),
      age: getValue("age"),
      profession: getValue("profession"),
      phoneNumber: getValue("phoneNumber"),
      whatsAppNumber: getValue("whatsappNumber"),
      emailId: getValue("emailId"),
      addressLine1: getValue("addressLine1"),
      addressLine2: getValue("addressLine2"),
      city: getValue("city"),
      state: getValue("state"),
      pincode: getValue("zipPostalCode"),
      enteredBy: "",
      ref_nameOfTheperson: getValue("salesOfficerName"),
      ref_place: getValue("salesOfficerContact"),
      shop_Address1: getValue("currentAddress1"),
      shop_Address2: getValue("currentAddress2"),
      shop_City: getValue("currentCityTown"),
      shop_District: getValue("currentDistrict"),
      shop_Landmark: getValue("currentLandmark"),
      shop_Pincode: getValue("currentPincode"),
      shop_Taluk: getValue("currentTaluk"),
      shop_location: shopLocation,
      sod_nameOfTheDealer: getValue("dealerName"),
      sod_place: getValue("dealerPlace"),
    };

    const requiredRules: Array<{
      fieldName: string;
      label: string;
      value: string;
    }> = [
      {
        fieldName: "firstName",
        label: "First Name",
        value: payload.firstName,
      },
      {
        fieldName: "phoneNumber",
        label: "Phone Number",
        value: payload.phoneNumber,
      },
      {
        fieldName: "addressLine1",
        label: "Address Line 1",
        value: payload.addressLine1,
      },
      { fieldName: "city", label: "City", value: payload.city },
      {
        fieldName: "zipPostalCode",
        label: "Zip / Postal Code",
        value: payload.pincode,
      },
      {
        fieldName: "currentPincode",
        label: "Site Pincode",
        value: payload.shop_Pincode,
      },
      {
        fieldName: "salesOfficerName",
        label: "Name Of The Person",
        value: payload.ref_nameOfTheperson,
      },
      {
        fieldName: "salesOfficerContact",
        label: "Contact No",
        value: payload.ref_place,
      },
      {
        fieldName: "dealerName",
        label: "Name Of The Dealer",
        value: payload.sod_nameOfTheDealer,
      },
      {
        fieldName: "dealerPlace",
        label: "Place",
        value: payload.sod_place,
      },
    ];

    for (const rule of requiredRules) {
      if (!rule.value) {
        setValidationError(rule.fieldName, `${rule.label} is required.`);
        return;
      }
    }

    const numericRules: Array<{
      fieldName: string;
      label: string;
      value: string;
      digits?: number;
      required?: boolean;
    }> = [
      {
        fieldName: "age",
        label: "Age",
        value: payload.age,
        required: true,
      },
      {
        fieldName: "phoneNumber",
        label: "Phone Number",
        value: payload.phoneNumber,
        digits: 10,
        required: true,
      },
      {
        fieldName: "whatsappNumber",
        label: "WhatsApp Number",
        value: payload.whatsAppNumber,
        digits: 10,
        required: false,
      },
      {
        fieldName: "zipPostalCode",
        label: "Permanent Pincode",
        value: payload.pincode,
        digits: 6,
        required: true,
      },
      {
        fieldName: "currentPincode",
        label: "Site Pincode",
        value: payload.shop_Pincode,
        digits: 6,
        required: true,
      },
      {
        fieldName: "salesOfficerContact",
        label: "Sales Officer Contact",
        value: payload.ref_place,
        digits: 10,
        required: true,
      },
    ];

    for (const rule of numericRules) {
      if (!rule.value) {
        if (rule.required) {
          setValidationError(rule.fieldName, `${rule.label} is required.`);
          return;
        }
        continue;
      }

      if (!/^\d+$/.test(rule.value)) {
        setValidationError(
          rule.fieldName,
          `${rule.label} must contain digits only.`,
        );
        return;
      }

      if (rule.digits && rule.value.length !== rule.digits) {
        setValidationError(
          rule.fieldName,
          `${rule.label} must be exactly ${rule.digits} digits.`,
        );
        return;
      }
    }

    if (payload.age && !/^\d{1,3}$/.test(payload.age)) {
      setValidationError("age", "Age must be a valid number.");
      return;
    }

    if (payload.age) {
      const numericAge = Number(payload.age);
      if (!Number.isFinite(numericAge) || numericAge < 18 || numericAge > 100) {
        setValidationError("age", "Age must be between 18 and 100.");
        return;
      }
    }

    if (
      payload.emailId &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.emailId)
    ) {
      setValidationError("emailId", "Enter a valid Email Id.");
      return;
    }
    if (phoneAvailability.exists) {
      setValidationError("phoneNumber", "Phone number is already registered.");
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
      const backendPayload = {
        formType: "individual" as const,
        title: payload.honorifics || undefined,
        pi_firstName: payload.firstName,
        pi_lastName: payload.lastName,
        pi_profession: payload.profession || "Individual",
        age: payload.age || undefined,
        pi_phone: payload.phoneNumber,
        pi_whatsAppNumber: payload.whatsAppNumber || undefined,
        pi_emailId: payload.emailId || undefined,
        pi_addressLane1: payload.addressLine1,
        pi_addressLane2: payload.addressLine2 || undefined,
        pi_city: payload.city,
        pi_state: payload.state,
        pi_pincode: payload.pincode,
        ref_nameOfTheperson: payload.ref_nameOfTheperson,
        ref_place: payload.ref_place,
        shop_Address1: payload.shop_Address1,
        shop_Address2: payload.shop_Address2 || undefined,
        shop_City: payload.shop_City,
        shop_District: payload.shop_District || undefined,
        shop_Taluk: payload.shop_Taluk || undefined,
        shop_Pincode: payload.shop_Pincode,
        shop_Landmark: payload.shop_Landmark || undefined,
        shop_location: payload.shop_location,
        sod_nameOfTheDealer: payload.sod_nameOfTheDealer,
        sod_place: payload.sod_place,
        sameAsAbove: formData.get("sameAsAbove") === "on",
        remarks: getValue("remarks") || undefined,
      };

      const response = await fetch(`${SK_BACKEND_URL}/form-submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(backendPayload),
      });

      const responseBody = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error(
          extractApiMessage(responseBody) || "Unable to submit registration.",
        );
      }

      const message =
        extractApiMessage(responseBody) ||
        (isRecord(responseBody) && typeof responseBody.skPassportNo === "string"
          ? "Registration submitted successfully."
          : "Registration submitted successfully.");
      setSubmitState({
        submitting: false,
        status: message,
        isSuccess: true,
      });
    } catch (error) {
      setSubmitState({
        submitting: false,
        status:
          error instanceof Error
            ? error.message
            : "Unable to submit registration.",
        isSuccess: false,
      });
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const sanitizeNumericInput = (input: HTMLInputElement, maxDigits: number) => {
    const sanitizedValue = input.value.replace(/\D/g, "").slice(0, maxDigits);
    if (input.value !== sanitizedValue) {
      input.value = sanitizedValue;
    }
  };

  useEffect(() => {
    const normalizedPhone = normalizePhone(phoneNumberInput);
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
          `${SK_BACKEND_URL}/form-submissions/phone-status?phone=${encodeURIComponent(normalizedPhone)}`,
        );
        const responseBody = (await response.json().catch(() => null)) as unknown;
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
  }, [phoneNumberInput]);

  return (
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
            I Wish To Build A home
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: isMobile ? 14 : 20,
              fontWeight: 600,
              color: "#344054",
            }}
          >
            Online Registration Form
          </p>
        </header>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onInputCapture={(event) => {
            const target = event.target;
            if (
              (target instanceof HTMLInputElement ||
                target instanceof HTMLSelectElement ||
                target instanceof HTMLTextAreaElement) &&
              target.name
            ) {
              if (target.name === invalidFieldName) {
                setInvalidFieldName("");
              }

              if (fieldErrors[target.name]) {
                setFieldErrors((previous) => {
                  const next = { ...previous };
                  delete next[target.name];
                  return next;
                });
              }
            }
          }}
          onChangeCapture={(event) => {
            const target = event.target;
            if (
              (target instanceof HTMLInputElement ||
                target instanceof HTMLSelectElement ||
                target instanceof HTMLTextAreaElement) &&
              target.name
            ) {
              if (target.name === invalidFieldName) {
                setInvalidFieldName("");
              }

              if (fieldErrors[target.name]) {
                setFieldErrors((previous) => {
                  const next = { ...previous };
                  delete next[target.name];
                  return next;
                });
              }
            }
          }}
        >
          <SectionTitle title="PERSONAL INFORMATION" />

          <div style={responsiveGridThree}>
            <select name="title" style={fieldStyle} defaultValue="Mr.">
              <option>Mr.</option>
              <option>Mrs.</option>
              <option>Ms.</option>
            </select>
            <div>
              <input
                name="firstName"
                placeholder="First Name *"
                style={getFieldStyleWithError("firstName")}
              />
              {fieldErrors.firstName && (
                <p style={fieldErrorTextStyle}>{fieldErrors.firstName}</p>
              )}
            </div>
            <input name="lastName" placeholder="Last Name" style={fieldStyle} />
          </div>

          <div style={responsiveGridThree}>
            <div>
              <input
                name="age"
                placeholder="Age"
                style={getFieldStyleWithError("age")}
                inputMode="numeric"
                maxLength={3}
                onInput={(event) =>
                  sanitizeNumericInput(event.currentTarget, 3)
                }
              />
              {fieldErrors.age && (
                <p style={fieldErrorTextStyle}>{fieldErrors.age}</p>
              )}
            </div>
            <input
              name="profession"
              placeholder="Profession"
              style={fieldStyle}
            />
            <div>
              <input
                name="phoneNumber"
                placeholder="Phone Number*"
                style={getFieldStyleWithError("phoneNumber")}
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => {
                  setPhoneNumberInput(event.target.value);
                  if (isSameAsAbove) {
                    setWhatsAppNumber(event.target.value);
                  }
                }}
                onInput={(event) =>
                  sanitizeNumericInput(event.currentTarget, 10)
                }
              />
              {fieldErrors.phoneNumber && (
                <p style={fieldErrorTextStyle}>{fieldErrors.phoneNumber}</p>
              )}
              {!fieldErrors.phoneNumber && phoneAvailability.status && (
                <p
                  style={{
                    ...fieldErrorTextStyle,
                    color: phoneAvailability.checking
                      ? "#175cd3"
                      : phoneAvailability.exists
                        ? "#b42318"
                        : "#067647",
                  }}
                >
                  {phoneAvailability.status}
                </p>
              )}
            </div>
          </div>

          <div style={responsiveGridTwo}>
            <div>
              <input
                name="whatsappNumber"
                placeholder="WhatsApp Number"
                style={getFieldStyleWithError("whatsappNumber")}
                inputMode="numeric"
                maxLength={10}
                value={whatsAppNumber}
                onChange={(event) => setWhatsAppNumber(event.target.value)}
                onInput={(event) =>
                  sanitizeNumericInput(event.currentTarget, 10)
                }
              />
              {fieldErrors.whatsappNumber && (
                <p style={fieldErrorTextStyle}>{fieldErrors.whatsappNumber}</p>
              )}
            </div>
            <div>
              <input
                name="emailId"
                placeholder="Email Id"
                style={getFieldStyleWithError("emailId")}
                type="email"
                autoComplete="email"
              />
              {fieldErrors.emailId && (
                <p style={fieldErrorTextStyle}>{fieldErrors.emailId}</p>
              )}
            </div>
          </div>

          <label style={checkboxLineStyle}>
            <input
              type="checkbox"
              name="sameAsAbove"
              checked={isSameAsAbove}
              onChange={(event) => {
                const checked = event.target.checked;
                setIsSameAsAbove(checked);
                if (checked) {
                  setWhatsAppNumber(phoneNumberInput);
                }
              }}
            />
            <span>Same as above</span>
          </label>

          <SectionTitle title="PERMANENT ADDRESS" />

          <div style={addressStackStyle}>
            <div>
              <input
                name="addressLine1"
                placeholder="Address Line 1*"
                style={getFieldStyleWithError("addressLine1")}
              />
              {fieldErrors.addressLine1 && (
                <p style={fieldErrorTextStyle}>{fieldErrors.addressLine1}</p>
              )}
            </div>
            <input
              name="addressLine2"
              placeholder="Address Line 2*"
              style={fieldStyle}
            />
          </div>

          <div style={responsiveGridTwo}>
            <div>
              <input
                name="city"
                placeholder="City*"
                style={getFieldStyleWithError("city")}
              />
              {fieldErrors.city && (
                <p style={fieldErrorTextStyle}>{fieldErrors.city}</p>
              )}
            </div>
            <select name="state" style={fieldStyle} defaultValue="Karnataka">
              <option>Karnataka</option>
              <option>Tamil Nadu</option>
              <option>Kerala</option>
              <option>Andhra Pradesh</option>
            </select>
          </div>

          <div style={responsiveGridTwo}>
            <div>
              <input
                name="zipPostalCode"
                placeholder="Zip / Postal Code*"
                style={getFieldStyleWithError("zipPostalCode")}
                inputMode="numeric"
                maxLength={6}
                onInput={(event) =>
                  sanitizeNumericInput(event.currentTarget, 6)
                }
              />
              {fieldErrors.zipPostalCode && (
                <p style={fieldErrorTextStyle}>{fieldErrors.zipPostalCode}</p>
              )}
            </div>
            <div />
          </div>

          <textarea name="remarks" placeholder="Remarks" style={remarkStyle} />

          <SectionTitle title="SITE LOCATION" />

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
            <select
              name="currentTaluk"
              style={getFieldStyleWithError("currentPincode")}
              value={selectedTaluk}
              onChange={(event) => setSelectedTaluk(event.target.value)}
            >
              <option value="">Taluk</option>
              {talukOptions.map((optionValue) => (
                <option key={optionValue} value={optionValue}>
                  {optionValue}
                </option>
              ))}
            </select>
          </div>

          <div style={responsiveGridTwo}>
            <input
              name="currentCityTown"
              placeholder="City/Town"
              style={fieldStyle}
            />
            <div>
              <input
                name="currentPincode"
                placeholder="Enter Pincode"
                style={getFieldStyleWithError("currentPincode")}
                inputMode="numeric"
                maxLength={6}
                value={currentPincode}
                onChange={(event) => {
                  const digitsOnly = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6);
                  setCurrentPincode(digitsOnly);
                  if (digitsOnly.length < 6) {
                    lastResolvedPincodeRef.current = "";
                  }
                }}
              />
              {fieldErrors.currentPincode && (
                <p style={fieldErrorTextStyle}>{fieldErrors.currentPincode}</p>
              )}
            </div>
          </div>
          {siteLocationStatus && (
            <p
              style={{
                ...siteStatusStyle,
                color: siteLocationLoading
                  ? "#175cd3"
                  : siteLocationStatus.includes("updated")
                    ? "#067647"
                    : "#b42318",
              }}
            >
              {siteLocationStatus}
            </p>
          )}

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
            <div>
              <input
                name="salesOfficerName"
                placeholder="Name Of The Person*"
                style={getFieldStyleWithError("salesOfficerName")}
              />
              {fieldErrors.salesOfficerName && (
                <p style={fieldErrorTextStyle}>
                  {fieldErrors.salesOfficerName}
                </p>
              )}
            </div>
            <div>
              <input
                name="salesOfficerContact"
                placeholder="Contact No*"
                style={getFieldStyleWithError("salesOfficerContact")}
                inputMode="numeric"
                maxLength={10}
                onInput={(event) =>
                  sanitizeNumericInput(event.currentTarget, 10)
                }
              />
              {fieldErrors.salesOfficerContact && (
                <p style={fieldErrorTextStyle}>
                  {fieldErrors.salesOfficerContact}
                </p>
              )}
            </div>
          </div>

          <SectionTitle title="DEALER DETAILS" />

          <div style={responsiveGridTwo}>
            <div>
              <input
                name="dealerName"
                placeholder="Name Of The Dealer*"
                style={getFieldStyleWithError("dealerName")}
              />
              {fieldErrors.dealerName && (
                <p style={fieldErrorTextStyle}>{fieldErrors.dealerName}</p>
              )}
            </div>
            <div>
              <input
                name="dealerPlace"
                placeholder="Place*"
                style={getFieldStyleWithError("dealerPlace")}
              />
              {fieldErrors.dealerPlace && (
                <p style={fieldErrorTextStyle}>{fieldErrors.dealerPlace}</p>
              )}
            </div>
          </div>

          <SectionTitle title="DECLARATION" />

          {submitState.status && (
            <p
              style={{
                ...submitStatusStyle,
                color: submitState.isSuccess ? "#067647" : "#b42318",
              }}
            >
              {submitState.status}
            </p>
          )}

          <p style={termsHeadingStyle}>TERMS & CONDITIONS*</p>
          <p style={termsBodyStyle}>
            I herewith declare that I would like to enrol myself to the SK SUPER
            TMT Passport to Progress Program and herewith agree to all the terms
            and conditions of the scheme laid out by the company from time to
            time. I hereby permit SK SUPER TMT or its other companies to send me
            regular updates.
          </p>

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

          <div style={declarationChoiceContainerStyle}>
            <div style={declarationButtonRowStyle}>
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
                style={{
                  ...submitButtonStyle,
                  backgroundColor:
                    submitState.submitting ||
                    phoneAvailability.checking ||
                    phoneAvailability.exists
                      ? "#98a2b3"
                      : submitButtonStyle.backgroundColor,
                  cursor:
                    submitState.submitting ||
                    phoneAvailability.checking ||
                    phoneAvailability.exists
                      ? "not-allowed"
                      : "pointer",
                }}
                disabled={
                  submitState.submitting ||
                  phoneAvailability.checking ||
                  phoneAvailability.exists
                }
              >
                {submitState.submitting ? "Submitting..." : "Submit"}
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
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

const gridThree = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 14,
};

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

const invalidFieldStyle = {
  border: "1px solid #d92d20",
  boxShadow: "0 0 0 1px rgba(217, 45, 32, 0.15)",
};

const addressStackStyle = {
  display: "grid",
  gap: 14,
  marginBottom: 14,
};

const remarkStyle = {
  ...fieldStyle,
  minHeight: 120,
  resize: "vertical" as const,
  marginBottom: 6,
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
  justifyContent: "space-between",
  gap: 12,
  marginTop: 14,
  marginBottom: 8,
};

const declarationButtonRowStyle = {
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
  width: "fit-content",
};

const declarationChoiceButtonSelectedStyle = {
  borderColor: "#1f78d1",
  backgroundColor: "#e8f1ff",
  color: "#0b4f94",
};

const submitButtonStyle = {
  border: "none",
  backgroundColor: "#d11b1b",
  color: "#ffffff",
  padding: "10px 34px",
  fontWeight: 700,
  borderRadius: 10,
  cursor: "pointer",
  width: "fit-content",
};

const termsHeadingStyle = {
  margin: "6px 0 10px",
  fontSize: 14,
  fontWeight: 700,
  color: "#101828",
};

const termsBodyStyle = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  color: "#344054",
};

const siteStatusStyle = {
  margin: "4px 0 10px",
  fontSize: 13,
  fontWeight: 600,
};

const submitStatusStyle = {
  margin: "4px 0 10px",
  fontSize: 13,
  fontWeight: 600,
};

const fieldErrorTextStyle = {
  margin: "6px 0 0",
  fontSize: 12,
  fontWeight: 600,
  color: "#b42318",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export default IndHouseForm;
