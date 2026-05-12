import {
  FuelArrangement,
  MaterialsBeingBurnt,
  FireUnitSize,
  TypeOfFireForm,
  FireRegistration,
  AnnouncementType,
  Announcement,
  SerProviderAction,
  SerProvider,
  ApplicationTask,
  MyContactDetails,
  FireRegistrationEdit,
  FirePermitStatus,
  FirePermitSummary,
  DateRange,
  FireDates,
  InitialFireRegistration,
  ReceiptConfirmation,
  SearchResultCount,
  SearchFormRequest,
  AcknowledgeService,
  UpgradeOption,
  TUPDetail,
  TUPQuote,
  LineItem,
  TUPQuoteResponse,
  TUPConfirmationRequest,
  TUPVehicleDetail,
  PaymentAvailability,
  MRSTUPVehicleLookup,
  MRSTUPLookupResponse,
  MRSRegistrationLookup,
  PaymentMethod,
  MRSActionTypes,
  MRSReceiptConfirmation,
  MRSRegistrationSummary,
  MRSTUPAcknowledgeService,
  TUPStatus,
  TUPSummary,
  MrsRegistrationSummary,
  MrsLicenceClass,
  MrsLicenceSummary,
  MrsDemeritsDetail,
  MrsDemeritsSummary,
  MastRenewalSummary,
  MastLicenceSummary,
  RegisteredOperatorType,
  MastRegistrationSummary,
  Point,
  MastMooringPermitSummary,
  MastCommercialVesselSummary,
  MrsLicenceMedicalCheck,
  MrsLicenceCondition,
  MrsLicenceDetailsClass,
  MrsLicenceType,
  MrsRegistrationStatus,
  MrsRegistrationVehicleInformation,
  MrsRegistrationDefect,
  PersonalDetails,
  AddressDetailsEdit,
  AddressEdit,
  Tas_messagedeliverymethods,
  NotificationPreferences,
  TuoProviderOption,
  TuoPreferenceOption,
  TuoPreferences,
  PopularService,
  PortalMessageDocument,
  Tas_messagepriority,
  Tas_message_tas_type,
  Tas_storagestatus,
  PortalMessage,
  Tas_documenttype,
  PortalDocument,
  SearchOptions,
  SearchMetadata,
  STPJourneyDetails,
  STPVehicleType,
  MRSVehicleLookupType,
  STPUnladenMass,
  STPVehicleInformation,
  STPQuoteLineItem,
  STPQuote,
  VehicleDetailsOptions,
  STPVehicleDetailOption,
  STPJourneyType,
  CommunicationMethod,
  FormAddressType,
  FormAddressDetail,
  FormAddressSummary,
  FormAddress,
  PaymentOption,
  ClientLinkLicence,
  ClientLinkRegistration,
  MRSLinkType,
  StateType,
  DocumentValidationType,
  BirthCertificateValidation,
  AustralianPassportValidation,
  VisaValidation,
  ImmiCardValidation,
  MyProfileWeb,
  VerificationStatus,
  FaceVerificationStatus,
  RWVPRenewalStatus,
  CitizenshipCertificateValidation,
  DriversLicenceValidation,
  MarriageCertificateValidation,
  RWVPReceiptConfirmation,
  RWVPRenewalSearchOption,
  RWVPRenewalApplicationStatus,
  RWVPRenewalListing,
  RWVPRenewalListingSearchResults,
  RWVPCardDetails,
  RWVPVerificationDocumnet,
  RWVPFaceVerification,
  FormUpload,
  RWVPRenewalDetails,
} from "./client";
import {
  FieldType,
  makeScalarField,
  buildSchema,
  defaultValueForFields,
  applyDefaultValues,
  makeCompoundField,
} from "@react-typed-forms/schemas";

export interface FireRegistrationForm {
  startDate: string;
  startTime: string;
  area: number | null;
  endDate: string | null;
  endTime: string | null;
  sentOn: string | null;
  fuelArrangement: FuelArrangement | null;
  nameOfBrigadeInAttendance: string | null;
  doYouRequireMultiLights: boolean | null;
  isYourFireLargerThan1MeterCubed: boolean;
  isYourPropertyLargerThan2000MetersSquared: boolean | null;
  materialsBeingBurnt: MaterialsBeingBurnt | null;
  materialsBeingBurntOther: string | null;
  purpose: string | null;
  acknowledgement: boolean | null;
  otherDetails: string | null;
  escadIncidentNumber: string | null;
  name: string | null;
  receiptNumber: string | null;
  fireUnitSize: FireUnitSize | null;
  latitude: number | null;
  longitude: number | null;
  propertyAddress: string | null;
  typeOfFireForm: TypeOfFireForm;
  fpAndTFBStatus: string | null;
  nearestRoadOrLandmark: string | null;
  insidePermitPeriod: boolean;
  insideFireBanPeriod: boolean;
  datesValid: boolean;
}

export const FireRegistrationSchema = buildSchema<FireRegistrationForm, "File">(
  {
    startDate: makeScalarField({
      type: FieldType.Date,
      notNullable: true,
      required: true,
      displayName: "Start Date",
    }),
    startTime: makeScalarField({
      type: FieldType.Time,
      notNullable: true,
      required: true,
      displayName: "Start Time",
    }),
    area: makeScalarField({
      type: FieldType.Double,
      displayName: "Area",
    }),
    endDate: makeScalarField({
      type: FieldType.Date,
      displayName: "End Date",
    }),
    endTime: makeScalarField({
      type: FieldType.Time,
      displayName: "End Time",
    }),
    sentOn: makeScalarField({
      type: FieldType.DateTime,
      displayName: "Sent On",
    }),
    fuelArrangement: makeScalarField({
      type: FieldType.String,
      displayName: "Fuel Arrangement",
      options: [
        {
          name: "Cut",
          value: "Cut",
        },
        {
          name: "Piles",
          value: "Piles",
        },
        {
          name: "Standing",
          value: "Standing",
        },
      ],
    }),
    nameOfBrigadeInAttendance: makeScalarField({
      type: FieldType.String,
      displayName: "Name Of Brigade In Attendance",
    }),
    doYouRequireMultiLights: makeScalarField({
      type: FieldType.Bool,
      displayName: "Do You Require Multi Lights",
    }),
    isYourFireLargerThan1MeterCubed: makeScalarField({
      type: FieldType.Bool,
      notNullable: true,
      required: true,
      displayName: "Is Your Fire Larger Than1 Meter Cubed",
    }),
    isYourPropertyLargerThan2000MetersSquared: makeScalarField({
      type: FieldType.Bool,
      displayName: "Is Your Property Larger Than2000 Meters Squared",
    }),
    materialsBeingBurnt: makeScalarField({
      type: FieldType.String,
      displayName: "Materials Being Burnt",
      options: [
        {
          name: "Grass",
          value: "Grass",
        },
        {
          name: "Bush / Scrub",
          value: "BushScrub",
        },
        {
          name: "Log heaps",
          value: "LogHeaps",
        },
        {
          name: "Logging slash",
          value: "LoggingSlash",
        },
        {
          name: "Garden waste",
          value: "GardenWaste",
        },
        {
          name: "Crop residue",
          value: "CropResidue",
        },
        {
          name: "Mixed fuels",
          value: "MixedFuels",
        },
        {
          name: "Domestic fire pot",
          value: "DomesticFirePot",
        },
        {
          name: "Woodfired cooker",
          value: "WoodfiredCooker",
        },
        {
          name: "Bonfire",
          value: "Bonfire",
        },
        {
          name: "Other",
          value: "Other",
        },
      ],
    }),
    materialsBeingBurntOther: makeScalarField({
      type: FieldType.String,
      displayName: "Materials Being Burnt Other",
    }),
    purpose: makeScalarField({
      type: FieldType.String,
      displayName: "Purpose",
    }),
    acknowledgement: makeScalarField({
      type: FieldType.Bool,
      displayName: "Acknowledgement",
    }),
    otherDetails: makeScalarField({
      type: FieldType.String,
      displayName: "Other Details",
    }),
    escadIncidentNumber: makeScalarField({
      type: FieldType.String,
      displayName: "ESCAD Incident Number",
    }),
    name: makeScalarField({
      type: FieldType.String,
      displayName: "Name",
    }),
    receiptNumber: makeScalarField({
      type: FieldType.String,
      displayName: "Receipt Number",
    }),
    fireUnitSize: makeScalarField({
      type: FieldType.String,
      displayName: "Fire Unit Size",
      options: [
        {
          name: "Cubic metres",
          value: "CubicMetres",
        },
        {
          name: "Hectares",
          value: "Hectares",
        },
      ],
    }),
    latitude: makeScalarField({
      type: FieldType.Double,
      displayName: "Latitude",
    }),
    longitude: makeScalarField({
      type: FieldType.Double,
      displayName: "Longitude",
    }),
    propertyAddress: makeScalarField({
      type: FieldType.String,
      displayName: "Property Address",
    }),
    typeOfFireForm: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Type Of Fire Form",
      options: [
        {
          name: "Permit",
          value: "Permit",
        },
        {
          name: "Burn Registration",
          value: "BurnRegistration",
        },
      ],
    }),
    fpAndTFBStatus: makeScalarField({
      type: FieldType.String,
      displayName: "FP AndTFB Status",
    }),
    nearestRoadOrLandmark: makeScalarField({
      type: FieldType.String,
      displayName: "Nearest Road Or Landmark",
    }),
    insidePermitPeriod: makeScalarField({
      type: FieldType.Bool,
      notNullable: true,
      required: true,
      displayName: "Inside Permit Period",
    }),
    insideFireBanPeriod: makeScalarField({
      type: FieldType.Bool,
      notNullable: true,
      required: true,
      displayName: "Inside Fire Ban Period",
    }),
    datesValid: makeScalarField({
      type: FieldType.Bool,
      notNullable: true,
      required: true,
      displayName: "Dates Valid",
    }),
  },
);

export const defaultFireRegistrationForm: FireRegistrationForm =
  defaultValueForFields(FireRegistrationSchema);

export function toFireRegistrationForm(
  v: FireRegistration,
): FireRegistrationForm {
  return applyDefaultValues(v, FireRegistrationSchema);
}

export interface AnnouncementForm {
  name: string;
  body: string | null;
  type: AnnouncementType | null;
  startDate: string | null;
  expiryDate: string | null;
}

export const AnnouncementSchema = buildSchema<AnnouncementForm, "File">({
  name: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Name",
  }),
  body: makeScalarField({
    type: FieldType.String,
    displayName: "Body",
  }),
  type: makeScalarField({
    type: FieldType.String,
    displayName: "Type",
    options: [
      {
        name: "Notice",
        value: "Notice",
      },
      {
        name: "Alert",
        value: "Alert",
      },
    ],
  }),
  startDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Start Date",
  }),
  expiryDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Expiry Date",
  }),
});

export const defaultAnnouncementForm: AnnouncementForm =
  defaultValueForFields(AnnouncementSchema);

export function toAnnouncementForm(v: Announcement): AnnouncementForm {
  return applyDefaultValues(v, AnnouncementSchema);
}

export interface SerProviderActionForm {
  name: string;
  description: string | null;
  actionId: string | null;
}

export const SerProviderActionSchema = buildSchema<
  SerProviderActionForm,
  "File"
>({
  name: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Name",
  }),
  description: makeScalarField({
    type: FieldType.String,
    displayName: "Description",
  }),
  actionId: makeScalarField({
    type: FieldType.String,
    displayName: "Action Id",
  }),
});

export const defaultSerProviderActionForm: SerProviderActionForm =
  defaultValueForFields(SerProviderActionSchema);

export function toSerProviderActionForm(
  v: SerProviderAction,
): SerProviderActionForm {
  return applyDefaultValues(v, SerProviderActionSchema);
}

export interface SerProviderForm {
  name: string;
  shortName: string;
  description: string | null;
  isLinked: boolean;
  isAvailable: boolean;
  isExpanded: boolean;
  actions: SerProviderActionForm[];
}

export const SerProviderSchema = buildSchema<SerProviderForm, "File">({
  name: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Name",
  }),
  shortName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Short Name",
  }),
  description: makeScalarField({
    type: FieldType.String,
    displayName: "Description",
  }),
  isLinked: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Linked",
  }),
  isAvailable: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Available",
  }),
  isExpanded: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Expanded",
  }),
  actions: makeCompoundField({
    children: SerProviderActionSchema,
    schemaRef: "SerProviderAction",
    collection: true,
    notNullable: true,
    displayName: "Actions",
  }),
});

export const defaultSerProviderForm: SerProviderForm =
  defaultValueForFields(SerProviderSchema);

export function toSerProviderForm(v: SerProvider): SerProviderForm {
  return applyDefaultValues(v, SerProviderSchema);
}

export interface ApplicationTaskForm {
  name: string;
  description: string;
  shortName: string;
  actionName: string;
  referenceId: string | null;
  days: number;
}

export const ApplicationTaskSchema = buildSchema<ApplicationTaskForm, "File">({
  name: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Name",
  }),
  description: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Description",
  }),
  shortName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Short Name",
  }),
  actionName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Action Name",
  }),
  referenceId: makeScalarField({
    type: FieldType.String,
    displayName: "Reference Id",
  }),
  days: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Days",
  }),
});

export const defaultApplicationTaskForm: ApplicationTaskForm =
  defaultValueForFields(ApplicationTaskSchema);

export function toApplicationTaskForm(v: ApplicationTask): ApplicationTaskForm {
  return applyDefaultValues(v, ApplicationTaskSchema);
}

export interface MyContactDetailsForm {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  displayName: string | null;
  mobilePhone: string | null;
  residentialAddress: string | null;
  postalAddress: string | null;
  emailAddress: string | null;
  alternativeNumber: string | null;
  dateOfBirth: string | null;
  unreadHighPriorityMessages: number | null;
  unreadMessages: number | null;
  unreadDocuments: number | null;
  announcements: AnnouncementForm[];
  allServices: SerProviderForm[];
  tasks: ApplicationTaskForm[];
  linkedServices: string[];
}

export const MyContactDetailsSchema = buildSchema<MyContactDetailsForm, "File">(
  {
    firstName: makeScalarField({
      type: FieldType.String,
      displayName: "First Name",
    }),
    lastName: makeScalarField({
      type: FieldType.String,
      displayName: "Last Name",
    }),
    preferredName: makeScalarField({
      type: FieldType.String,
      displayName: "Preferred Name",
    }),
    displayName: makeScalarField({
      type: FieldType.String,
      displayName: "Display Name",
    }),
    mobilePhone: makeScalarField({
      type: FieldType.String,
      displayName: "Mobile Phone",
    }),
    residentialAddress: makeScalarField({
      type: FieldType.String,
      displayName: "Residential Address",
    }),
    postalAddress: makeScalarField({
      type: FieldType.String,
      displayName: "Postal Address",
    }),
    emailAddress: makeScalarField({
      type: FieldType.String,
      displayName: "Email Address",
    }),
    alternativeNumber: makeScalarField({
      type: FieldType.String,
      displayName: "Alternative Number",
    }),
    dateOfBirth: makeScalarField({
      type: FieldType.Date,
      displayName: "Date Of Birth",
    }),
    unreadHighPriorityMessages: makeScalarField({
      type: FieldType.Int,
      displayName: "Unread High Priority Messages",
    }),
    unreadMessages: makeScalarField({
      type: FieldType.Int,
      displayName: "Unread Messages",
    }),
    unreadDocuments: makeScalarField({
      type: FieldType.Int,
      displayName: "Unread Documents",
    }),
    announcements: makeCompoundField({
      children: AnnouncementSchema,
      schemaRef: "Announcement",
      collection: true,
      notNullable: true,
      displayName: "Announcements",
    }),
    allServices: makeCompoundField({
      children: SerProviderSchema,
      schemaRef: "SerProvider",
      collection: true,
      notNullable: true,
      displayName: "All Services",
    }),
    tasks: makeCompoundField({
      children: ApplicationTaskSchema,
      schemaRef: "ApplicationTask",
      collection: true,
      notNullable: true,
      displayName: "Tasks",
    }),
    linkedServices: makeScalarField({
      type: FieldType.String,
      collection: true,
      notNullable: true,
      displayName: "Linked Services",
    }),
  },
);

export const defaultMyContactDetailsForm: MyContactDetailsForm =
  defaultValueForFields(MyContactDetailsSchema);

export function toMyContactDetailsForm(
  v: MyContactDetails,
): MyContactDetailsForm {
  return applyDefaultValues(v, MyContactDetailsSchema);
}

export interface FireRegistrationEditForm {
  registration: FireRegistrationForm;
  contact: MyContactDetailsForm;
  baseUrl: string | null;
}

export const FireRegistrationEditSchema = buildSchema<
  FireRegistrationEditForm,
  "File"
>({
  registration: makeCompoundField({
    children: FireRegistrationSchema,
    schemaRef: "FireRegistration",
    notNullable: true,
    displayName: "Registration",
  }),
  contact: makeCompoundField({
    children: MyContactDetailsSchema,
    schemaRef: "MyContactDetails",
    notNullable: true,
    displayName: "Contact",
  }),
  baseUrl: makeScalarField({
    type: FieldType.String,
    displayName: "Base Url",
  }),
});

export const defaultFireRegistrationEditForm: FireRegistrationEditForm =
  defaultValueForFields(FireRegistrationEditSchema);

export function toFireRegistrationEditForm(
  v: FireRegistrationEdit,
): FireRegistrationEditForm {
  return applyDefaultValues(v, FireRegistrationEditSchema);
}

export interface FirePermitSummaryForm {
  id: string;
  date: string;
  status: FirePermitStatus;
  type: TypeOfFireForm;
  escadNumber: string | null;
  receiptNumber: string | null;
  propertyAddress: string;
  editAvailable: boolean;
}

export const FirePermitSummarySchema = buildSchema<
  FirePermitSummaryForm,
  "File"
>({
  id: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  date: makeScalarField({
    type: FieldType.Date,
    notNullable: true,
    required: true,
    displayName: "Date",
  }),
  status: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Status",
    options: [
      {
        name: "Draft",
        value: "Draft",
      },
      {
        name: "Registered",
        value: "Registered",
      },
      {
        name: "Submitted",
        value: "Submitted",
      },
      {
        name: "Error",
        value: "Error",
      },
    ],
  }),
  type: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Type",
    options: [
      {
        name: "Permit",
        value: "Permit",
      },
      {
        name: "Burn Registration",
        value: "BurnRegistration",
      },
    ],
  }),
  escadNumber: makeScalarField({
    type: FieldType.String,
    displayName: "ESCAD Number",
  }),
  receiptNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Receipt Number",
  }),
  propertyAddress: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Property Address",
  }),
  editAvailable: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Edit Available",
  }),
});

export const defaultFirePermitSummaryForm: FirePermitSummaryForm =
  defaultValueForFields(FirePermitSummarySchema);

export function toFirePermitSummaryForm(
  v: FirePermitSummary,
): FirePermitSummaryForm {
  return applyDefaultValues(v, FirePermitSummarySchema);
}

export interface DateRangeForm {
  start: string;
  end: string | null;
}

export const DateRangeSchema = buildSchema<DateRangeForm, "File">({
  start: makeScalarField({
    type: FieldType.DateTime,
    notNullable: true,
    required: true,
    displayName: "Start",
  }),
  end: makeScalarField({
    type: FieldType.DateTime,
    displayName: "End",
  }),
});

export const defaultDateRangeForm: DateRangeForm =
  defaultValueForFields(DateRangeSchema);

export function toDateRangeForm(v: DateRange): DateRangeForm {
  return applyDefaultValues(v, DateRangeSchema);
}

export interface FireDatesForm {
  area: string;
  permit: DateRangeForm | null;
  fireBan: DateRangeForm | null;
}

export const FireDatesSchema = buildSchema<FireDatesForm, "File">({
  area: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Area",
  }),
  permit: makeCompoundField({
    children: DateRangeSchema,
    schemaRef: "DateRange",
    displayName: "Permit",
  }),
  fireBan: makeCompoundField({
    children: DateRangeSchema,
    schemaRef: "DateRange",
    displayName: "Fire Ban",
  }),
});

export const defaultFireDatesForm: FireDatesForm =
  defaultValueForFields(FireDatesSchema);

export function toFireDatesForm(v: FireDates): FireDatesForm {
  return applyDefaultValues(v, FireDatesSchema);
}

export interface InitialFireRegistrationForm {
  location: string;
  allowedToBurn: boolean | null;
  locationStatus: FireDatesForm | null;
  details: FireRegistrationEditForm;
  typeOfFireForm: TypeOfFireForm;
  burnRegistrationEnabled: boolean;
  initialType: TypeOfFireForm;
  nearestRoadOrLandmark: string | null;
  containsAddress: boolean | null;
}

export const InitialFireRegistrationSchema = buildSchema<
  InitialFireRegistrationForm,
  "File"
>({
  location: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Location",
  }),
  allowedToBurn: makeScalarField({
    type: FieldType.Bool,
    displayName: "Allowed To Burn",
  }),
  locationStatus: makeCompoundField({
    children: FireDatesSchema,
    schemaRef: "FireDates",
    displayName: "Location Status",
  }),
  details: makeCompoundField({
    children: FireRegistrationEditSchema,
    schemaRef: "FireRegistrationEdit",
    notNullable: true,
    displayName: "Details",
  }),
  typeOfFireForm: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Type Of Fire Form",
    options: [
      {
        name: "Permit",
        value: "Permit",
      },
      {
        name: "Burn Registration",
        value: "BurnRegistration",
      },
    ],
  }),
  burnRegistrationEnabled: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Burn Registration Enabled",
  }),
  initialType: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Initial Type",
    options: [
      {
        name: "Permit",
        value: "Permit",
      },
      {
        name: "Burn Registration",
        value: "BurnRegistration",
      },
    ],
  }),
  nearestRoadOrLandmark: makeScalarField({
    type: FieldType.String,
    displayName: "Nearest Road Or Landmark",
  }),
  containsAddress: makeScalarField({
    type: FieldType.Bool,
    displayName: "Contains Address",
  }),
});

export const defaultInitialFireRegistrationForm: InitialFireRegistrationForm =
  defaultValueForFields(InitialFireRegistrationSchema);

export function toInitialFireRegistrationForm(
  v: InitialFireRegistration,
): InitialFireRegistrationForm {
  return applyDefaultValues(v, InitialFireRegistrationSchema);
}

export interface ReceiptConfirmationForm {
  receipt: string;
  formType: TypeOfFireForm;
  failure: boolean;
}

export const ReceiptConfirmationSchema = buildSchema<
  ReceiptConfirmationForm,
  "File"
>({
  receipt: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Receipt",
  }),
  formType: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Form Type",
    options: [
      {
        name: "Permit",
        value: "Permit",
      },
      {
        name: "Burn Registration",
        value: "BurnRegistration",
      },
    ],
  }),
  failure: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Failure",
  }),
});

export const defaultReceiptConfirmationForm: ReceiptConfirmationForm =
  defaultValueForFields(ReceiptConfirmationSchema);

export function toReceiptConfirmationForm(
  v: ReceiptConfirmation,
): ReceiptConfirmationForm {
  return applyDefaultValues(v, ReceiptConfirmationSchema);
}

export interface SearchResultCountForm {
  total: number;
  firstResult: number;
  lastResult: number;
  resultName: string;
}

export const SearchResultCountSchema = buildSchema<
  SearchResultCountForm,
  "File"
>({
  total: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Total",
  }),
  firstResult: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "First Result",
  }),
  lastResult: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Last Result",
  }),
  resultName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Result Name",
  }),
});

export const defaultSearchResultCountForm: SearchResultCountForm =
  defaultValueForFields(SearchResultCountSchema);

export function toSearchResultCountForm(
  v: SearchResultCount,
): SearchResultCountForm {
  return applyDefaultValues(v, SearchResultCountSchema);
}

export interface SearchFormRequestForm {
  orderBy: string;
  perPage: number;
  page: number;
}

export const SearchFormRequestSchema = buildSchema<
  SearchFormRequestForm,
  "File"
>({
  orderBy: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Order By",
  }),
  perPage: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Per Page",
  }),
  page: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Page",
  }),
});

export const defaultSearchFormRequestForm: SearchFormRequestForm =
  defaultValueForFields(SearchFormRequestSchema);

export function toSearchFormRequestForm(
  v: SearchFormRequest,
): SearchFormRequestForm {
  return applyDefaultValues(v, SearchFormRequestSchema);
}

export interface SearchForm {
  resultCount: SearchResultCountForm | null;
  request: SearchFormRequestForm;
}

export const SearchFormSchema = buildSchema<SearchForm, "File">({
  resultCount: makeCompoundField({
    children: SearchResultCountSchema,
    schemaRef: "SearchResultCount",
    displayName: "Result Count",
  }),
  request: makeCompoundField({
    children: SearchFormRequestSchema,
    schemaRef: "SearchFormRequest",
    notNullable: true,
    displayName: "Request",
  }),
});

export const defaultSearchForm: SearchForm =
  defaultValueForFields(SearchFormSchema);

export interface AcknowledgeServiceForm {
  acknowledged: boolean;
  contact: MyContactDetailsForm;
}

export const AcknowledgeServiceSchema = buildSchema<
  AcknowledgeServiceForm,
  "File"
>({
  acknowledged: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Acknowledged",
  }),
  contact: makeCompoundField({
    children: MyContactDetailsSchema,
    schemaRef: "MyContactDetails",
    notNullable: true,
    displayName: "Contact",
  }),
});

export const defaultAcknowledgeServiceForm: AcknowledgeServiceForm =
  defaultValueForFields(AcknowledgeServiceSchema);

export function toAcknowledgeServiceForm(
  v: AcknowledgeService,
): AcknowledgeServiceForm {
  return applyDefaultValues(v, AcknowledgeServiceSchema);
}

export interface UpgradeOptionForm {
  classification: string;
  vehicleUseType: string;
  grossCombinationMass: number;
  vehicleAxles: number;
  imageUrl: string | null;
  description: string | null;
}

export const UpgradeOptionSchema = buildSchema<UpgradeOptionForm, "File">({
  classification: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Classification",
  }),
  vehicleUseType: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Vehicle Use Type",
  }),
  grossCombinationMass: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Gross Combination Mass",
  }),
  vehicleAxles: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Vehicle Axles",
  }),
  imageUrl: makeScalarField({
    type: FieldType.String,
    displayName: "Image Url",
  }),
  description: makeScalarField({
    type: FieldType.String,
    displayName: "Description",
  }),
});

export const defaultUpgradeOptionForm: UpgradeOptionForm =
  defaultValueForFields(UpgradeOptionSchema);

export function toUpgradeOptionForm(v: UpgradeOption): UpgradeOptionForm {
  return applyDefaultValues(v, UpgradeOptionSchema);
}

export interface TUPDetailForm {
  grossCombinedMass: number;
  currentClassification: string;
  vehicleUseType: string;
  axles: number;
  expiry: string | null;
  upgradeOptions: UpgradeOptionForm[];
}

export const TUPDetailSchema = buildSchema<TUPDetailForm, "File">({
  grossCombinedMass: makeScalarField({
    type: FieldType.Double,
    notNullable: true,
    required: true,
    displayName: "Gross Combined Mass",
  }),
  currentClassification: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Current Classification",
  }),
  vehicleUseType: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Vehicle Use Type",
  }),
  axles: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Axles",
  }),
  expiry: makeScalarField({
    type: FieldType.DateTime,
    displayName: "Expiry",
  }),
  upgradeOptions: makeCompoundField({
    children: UpgradeOptionSchema,
    schemaRef: "UpgradeOption",
    collection: true,
    notNullable: true,
    displayName: "Upgrade Options",
  }),
});

export const defaultTUPDetailForm: TUPDetailForm =
  defaultValueForFields(TUPDetailSchema);

export function toTUPDetailForm(v: TUPDetail): TUPDetailForm {
  return applyDefaultValues(v, TUPDetailSchema);
}

export interface TUPQuoteForm {
  registrationId: number;
  startDate: string | null;
  endDate: string | null;
  fromClassification: string;
  toClassification: string | null;
  combinationAxles: number;
  ownVehicle: boolean;
  expiryDate: string | null;
}

export const TUPQuoteSchema = buildSchema<TUPQuoteForm, "File">({
  registrationId: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Registration Id",
  }),
  startDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Start Date",
  }),
  endDate: makeScalarField({
    type: FieldType.Date,
    displayName: "End Date",
  }),
  fromClassification: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "From Classification",
  }),
  toClassification: makeScalarField({
    type: FieldType.String,
    displayName: "To Classification",
  }),
  combinationAxles: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Combination Axles",
  }),
  ownVehicle: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Own Vehicle",
  }),
  expiryDate: makeScalarField({
    type: FieldType.DateTime,
    displayName: "Expiry Date",
  }),
});

export const defaultTUPQuoteForm: TUPQuoteForm =
  defaultValueForFields(TUPQuoteSchema);

export function toTUPQuoteForm(v: TUPQuote): TUPQuoteForm {
  return applyDefaultValues(v, TUPQuoteSchema);
}

export interface LineItemForm {
  sequenceNumber: number | null;
  feeCode: string;
  description: string;
  amount: number | null;
}

export const LineItemSchema = buildSchema<LineItemForm, "File">({
  sequenceNumber: makeScalarField({
    type: FieldType.Int,
    displayName: "Sequence Number",
  }),
  feeCode: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Fee Code",
  }),
  description: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Description",
  }),
  amount: makeScalarField({
    type: FieldType.Double,
    displayName: "Amount",
  }),
});

export const defaultLineItemForm: LineItemForm =
  defaultValueForFields(LineItemSchema);

export function toLineItemForm(v: LineItem): LineItemForm {
  return applyDefaultValues(v, LineItemSchema);
}

export interface TUPQuoteResponseForm {
  correlationId: string;
  permitFee: number | null;
  permitLineItems: LineItemForm[];
}

export const TUPQuoteResponseSchema = buildSchema<TUPQuoteResponseForm, "File">(
  {
    correlationId: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Correlation Id",
    }),
    permitFee: makeScalarField({
      type: FieldType.Double,
      displayName: "Permit Fee",
    }),
    permitLineItems: makeCompoundField({
      children: LineItemSchema,
      schemaRef: "LineItem",
      collection: true,
      notNullable: true,
      displayName: "Permit Line Items",
    }),
  },
);

export const defaultTUPQuoteResponseForm: TUPQuoteResponseForm =
  defaultValueForFields(TUPQuoteResponseSchema);

export function toTUPQuoteResponseForm(
  v: TUPQuoteResponse,
): TUPQuoteResponseForm {
  return applyDefaultValues(v, TUPQuoteResponseSchema);
}

export interface TUPConfirmationRequestForm {
  transectionId: string | null;
  paymentReference: string | null;
  paymentAmount: number | null;
  correlationId: string;
  registrationId: number;
  currentFeeCode: string;
  newFeeCode: string;
  combinationAxles: number;
  declaration: boolean | null;
  startDate: string;
  endDate: string;
  paymentReceiptNumber: string | null;
  singleUseToken: string | null;
}

export const TUPConfirmationRequestSchema = buildSchema<
  TUPConfirmationRequestForm,
  "File"
>({
  transectionId: makeScalarField({
    type: FieldType.String,
    displayName: "Transection Id",
  }),
  paymentReference: makeScalarField({
    type: FieldType.String,
    displayName: "Payment Reference",
  }),
  paymentAmount: makeScalarField({
    type: FieldType.Double,
    displayName: "Payment Amount",
  }),
  correlationId: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Correlation Id",
  }),
  registrationId: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Registration Id",
  }),
  currentFeeCode: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Current Fee Code",
  }),
  newFeeCode: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "New Fee Code",
  }),
  combinationAxles: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Combination Axles",
  }),
  declaration: makeScalarField({
    type: FieldType.Bool,
    displayName: "Declaration",
  }),
  startDate: makeScalarField({
    type: FieldType.DateTime,
    notNullable: true,
    required: true,
    displayName: "Start Date",
  }),
  endDate: makeScalarField({
    type: FieldType.DateTime,
    notNullable: true,
    required: true,
    displayName: "End Date",
  }),
  paymentReceiptNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Payment Receipt Number",
  }),
  singleUseToken: makeScalarField({
    type: FieldType.String,
    displayName: "Single Use Token",
  }),
});

export const defaultTUPConfirmationRequestForm: TUPConfirmationRequestForm =
  defaultValueForFields(TUPConfirmationRequestSchema);

export function toTUPConfirmationRequestForm(
  v: TUPConfirmationRequest,
): TUPConfirmationRequestForm {
  return applyDefaultValues(v, TUPConfirmationRequestSchema);
}

export interface TUPVehicleDetailForm {
  plateNumber: string;
  make: string;
  model: string;
  description: string;
}

export const TUPVehicleDetailSchema = buildSchema<TUPVehicleDetailForm, "File">(
  {
    plateNumber: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Plate Number",
    }),
    make: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Make",
    }),
    model: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Model",
    }),
    description: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Description",
    }),
  },
);

export const defaultTUPVehicleDetailForm: TUPVehicleDetailForm =
  defaultValueForFields(TUPVehicleDetailSchema);

export function toTUPVehicleDetailForm(
  v: TUPVehicleDetail,
): TUPVehicleDetailForm {
  return applyDefaultValues(v, TUPVehicleDetailSchema);
}

export interface PaymentAvailabilityForm {
  applePay: boolean | null;
  googlePay: boolean | null;
  creditCard: boolean | null;
}

export const PaymentAvailabilitySchema = buildSchema<
  PaymentAvailabilityForm,
  "File"
>({
  applePay: makeScalarField({
    type: FieldType.Bool,
    displayName: "Apple Pay",
  }),
  googlePay: makeScalarField({
    type: FieldType.Bool,
    displayName: "Google Pay",
  }),
  creditCard: makeScalarField({
    type: FieldType.Bool,
    displayName: "Credit Card",
  }),
});

export const defaultPaymentAvailabilityForm: PaymentAvailabilityForm =
  defaultValueForFields(PaymentAvailabilitySchema);

export function toPaymentAvailabilityForm(
  v: PaymentAvailability,
): PaymentAvailabilityForm {
  return applyDefaultValues(v, PaymentAvailabilitySchema);
}

export interface MRSTUPVehicleLookupForm {
  clientId: string;
  plateNumber: string;
  vin: string | null;
  chassisNumber: string | null;
}

export const MRSTUPVehicleLookupSchema = buildSchema<
  MRSTUPVehicleLookupForm,
  "File"
>({
  clientId: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Client Id",
  }),
  plateNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Plate Number",
  }),
  vin: makeScalarField({
    type: FieldType.String,
    displayName: "Vin",
  }),
  chassisNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Chassis Number",
  }),
});

export const defaultMRSTUPVehicleLookupForm: MRSTUPVehicleLookupForm =
  defaultValueForFields(MRSTUPVehicleLookupSchema);

export function toMRSTUPVehicleLookupForm(
  v: MRSTUPVehicleLookup,
): MRSTUPVehicleLookupForm {
  return applyDefaultValues(v, MRSTUPVehicleLookupSchema);
}

export interface MRSTUPLookupResponseForm {
  clientId: string;
  clientName: string;
  make: string;
  model: string;
  colour: string;
  status: string;
  tupEligible: boolean;
  tupAvailable: boolean;
  tupUnavailableReason: string | null;
  expiry: string | null;
  registrationId: number | null;
}

export const MRSTUPLookupResponseSchema = buildSchema<
  MRSTUPLookupResponseForm,
  "File"
>({
  clientId: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Client Id",
  }),
  clientName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Client Name",
  }),
  make: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Make",
  }),
  model: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Model",
  }),
  colour: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Colour",
  }),
  status: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Status",
  }),
  tupEligible: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "TUP Eligible",
  }),
  tupAvailable: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "TUP Available",
  }),
  tupUnavailableReason: makeScalarField({
    type: FieldType.String,
    displayName: "TUP Unavailable Reason",
  }),
  expiry: makeScalarField({
    type: FieldType.DateTime,
    displayName: "Expiry",
  }),
  registrationId: makeScalarField({
    type: FieldType.Int,
    displayName: "Registration Id",
  }),
});

export const defaultMRSTUPLookupResponseForm: MRSTUPLookupResponseForm =
  defaultValueForFields(MRSTUPLookupResponseSchema);

export function toMRSTUPLookupResponseForm(
  v: MRSTUPLookupResponse,
): MRSTUPLookupResponseForm {
  return applyDefaultValues(v, MRSTUPLookupResponseSchema);
}

export interface MRSRegistrationLookupForm {
  registrationId: number;
  description: string;
}

export const MRSRegistrationLookupSchema = buildSchema<
  MRSRegistrationLookupForm,
  "File"
>({
  registrationId: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Registration Id",
  }),
  description: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Description",
  }),
});

export const defaultMRSRegistrationLookupForm: MRSRegistrationLookupForm =
  defaultValueForFields(MRSRegistrationLookupSchema);

export function toMRSRegistrationLookupForm(
  v: MRSRegistrationLookup,
): MRSRegistrationLookupForm {
  return applyDefaultValues(v, MRSRegistrationLookupSchema);
}

export interface TUPsForm {
  currentPage: number;
  tupDetails: TUPDetailForm;
  toClassification: string;
  tupQuote: TUPQuoteForm;
  tupQuoteResponse: TUPQuoteResponseForm;
  tupConfirmationRequest: TUPConfirmationRequestForm;
  tupVehicleDetails: TUPVehicleDetailForm;
  receiptNumber: string | null;
  paymentMethod: PaymentMethod;
  availability: PaymentAvailabilityForm;
  ownVehicle: boolean | null;
  tupVehicleLookup: MRSTUPVehicleLookupForm;
  tupLookupResponse: MRSTUPLookupResponseForm | null;
  selectedVehicleId: number | null;
  existingVehicles: MRSRegistrationLookupForm[];
}

export const TUPsFormSchema = buildSchema<TUPsForm, "File">({
  currentPage: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Current Page",
  }),
  tupDetails: makeCompoundField({
    children: TUPDetailSchema,
    schemaRef: "TUPDetail",
    notNullable: true,
    displayName: "TUP Details",
  }),
  toClassification: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "To Classification",
    options: [
      {
        name: "SR2",
        value: "SR2",
      },
      {
        name: "SR3",
        value: "SR3",
      },
    ],
  }),
  tupQuote: makeCompoundField({
    children: TUPQuoteSchema,
    schemaRef: "TUPQuote",
    notNullable: true,
    displayName: "Tup Quote",
  }),
  tupQuoteResponse: makeCompoundField({
    children: TUPQuoteResponseSchema,
    schemaRef: "TUPQuoteResponse",
    notNullable: true,
    displayName: "Tup Quote Response",
  }),
  tupConfirmationRequest: makeCompoundField({
    children: TUPConfirmationRequestSchema,
    schemaRef: "TUPConfirmationRequest",
    notNullable: true,
    displayName: "Tup Confirmation Request",
  }),
  tupVehicleDetails: makeCompoundField({
    children: TUPVehicleDetailSchema,
    schemaRef: "TUPVehicleDetail",
    notNullable: true,
    displayName: "Tup Vehicle Details",
  }),
  receiptNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Receipt Number",
  }),
  paymentMethod: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Payment Method",
    options: [
      {
        name: "Google Pay",
        value: 0,
      },
      {
        name: "Apple Pay",
        value: 1,
      },
      {
        name: "Credit or debit card (Visa and MasterCard only)",
        value: 2,
      },
      {
        name: "BPAY",
        value: 3,
      },
      {
        name: "PayTo",
        value: 4,
      },
    ],
  }),
  availability: makeCompoundField({
    children: PaymentAvailabilitySchema,
    schemaRef: "PaymentAvailability",
    notNullable: true,
    displayName: "Availability",
  }),
  ownVehicle: makeScalarField({
    type: FieldType.Bool,
    displayName: "Own Vehicle",
  }),
  tupVehicleLookup: makeCompoundField({
    children: MRSTUPVehicleLookupSchema,
    schemaRef: "MRSTUPVehicleLookup",
    notNullable: true,
    displayName: "TUP Vehicle Lookup",
  }),
  tupLookupResponse: makeCompoundField({
    children: MRSTUPLookupResponseSchema,
    schemaRef: "MRSTUPLookupResponse",
    displayName: "TUP Lookup Response",
  }),
  selectedVehicleId: makeScalarField({
    type: FieldType.Int,
    displayName: "Selected Vehicle Id",
  }),
  existingVehicles: makeCompoundField({
    children: MRSRegistrationLookupSchema,
    schemaRef: "MRSRegistrationLookup",
    collection: true,
    notNullable: true,
    displayName: "Existing Vehicles",
  }),
});

export const defaultTUPsForm: TUPsForm = defaultValueForFields(TUPsFormSchema);

export interface MRSReceiptConfirmationForm {
  receipt: string;
  mrsActionTypes: MRSActionTypes | null;
  message: string | null;
  customMessage: string | null;
  failure: boolean;
}

export const MRSReceiptConfirmationSchema = buildSchema<
  MRSReceiptConfirmationForm,
  "File"
>({
  receipt: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Receipt",
  }),
  mrsActionTypes: makeScalarField({
    type: FieldType.Int,
    displayName: "MRS Action Types",
    options: [
      {
        name: "LinkAccount",
        value: 0,
      },
      {
        name: "RenewDriverLicence",
        value: 1,
      },
      {
        name: "RenewVehicleRegistration",
        value: 2,
      },
      {
        name: "ShortTermPermit",
        value: 3,
      },
      {
        name: "UnlinkAccount",
        value: 4,
      },
      {
        name: "Other",
        value: 5,
      },
      {
        name: "Orderanaccessory_bikerackplate",
        value: 6,
      },
      {
        name: "RegistrationCertificateRequest",
        value: 7,
      },
      {
        name: "RequestDrivingHistory",
        value: 8,
      },
      {
        name: "NewAccountPlatesPlus",
        value: 9,
      },
      {
        name: "UpdateAddress",
        value: 10,
      },
      {
        name: "TemporaryUpgradePermit",
        value: 11,
      },
    ],
  }),
  message: makeScalarField({
    type: FieldType.String,
    displayName: "Message",
  }),
  customMessage: makeScalarField({
    type: FieldType.String,
    displayName: "Custom Message",
  }),
  failure: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Failure",
  }),
});

export const defaultMRSReceiptConfirmationForm: MRSReceiptConfirmationForm =
  defaultValueForFields(MRSReceiptConfirmationSchema);

export function toMRSReceiptConfirmationForm(
  v: MRSReceiptConfirmation,
): MRSReceiptConfirmationForm {
  return applyDefaultValues(v, MRSReceiptConfirmationSchema);
}

export interface MRSReceiptFailureForm {}

export const MRSReceiptFailureFormSchema = buildSchema<
  MRSReceiptFailureForm,
  "File"
>({});

export const defaultMRSReceiptFailureForm: MRSReceiptFailureForm =
  defaultValueForFields(MRSReceiptFailureFormSchema);

export interface MRSRegistrationSummaryForm {
  id: number;
  status: string;
  plateNumber: string;
  description: string;
  hasDefects: boolean | null;
  renewalAvailable: boolean | null;
  transferAvailable: boolean | null;
  transferPending: boolean | null;
  disposalAvailable: boolean | null;
  disposalPending: boolean | null;
  isVehicleStolen: boolean | null;
  isVehicleStatutoryWriteOff: boolean | null;
  isVehicleRepairableWriteOff: boolean | null;
  bikePlateEligible: boolean | null;
  registrationExpiry: string | null;
  colour: string | null;
  expiresSoon: boolean | null;
  tupAvailable: boolean;
}

export const MRSRegistrationSummarySchema = buildSchema<
  MRSRegistrationSummaryForm,
  "File"
>({
  id: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  status: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Status",
  }),
  plateNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Plate Number",
  }),
  description: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Description",
  }),
  hasDefects: makeScalarField({
    type: FieldType.Bool,
    displayName: "Has Defects",
  }),
  renewalAvailable: makeScalarField({
    type: FieldType.Bool,
    displayName: "Renewal Available",
  }),
  transferAvailable: makeScalarField({
    type: FieldType.Bool,
    displayName: "Transfer Available",
  }),
  transferPending: makeScalarField({
    type: FieldType.Bool,
    displayName: "Transfer Pending",
  }),
  disposalAvailable: makeScalarField({
    type: FieldType.Bool,
    displayName: "Disposal Available",
  }),
  disposalPending: makeScalarField({
    type: FieldType.Bool,
    displayName: "Disposal Pending",
  }),
  isVehicleStolen: makeScalarField({
    type: FieldType.Bool,
    displayName: "Is Vehicle Stolen",
  }),
  isVehicleStatutoryWriteOff: makeScalarField({
    type: FieldType.Bool,
    displayName: "Is Vehicle Statutory Write Off",
  }),
  isVehicleRepairableWriteOff: makeScalarField({
    type: FieldType.Bool,
    displayName: "Is Vehicle Repairable Write Off",
  }),
  bikePlateEligible: makeScalarField({
    type: FieldType.Bool,
    displayName: "Bike Plate Eligible",
  }),
  registrationExpiry: makeScalarField({
    type: FieldType.DateTime,
    displayName: "Registration Expiry",
  }),
  colour: makeScalarField({
    type: FieldType.String,
    displayName: "Colour",
  }),
  expiresSoon: makeScalarField({
    type: FieldType.Bool,
    displayName: "Expires Soon",
  }),
  tupAvailable: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Tup Available",
  }),
});

export const defaultMRSRegistrationSummaryForm: MRSRegistrationSummaryForm =
  defaultValueForFields(MRSRegistrationSummarySchema);

export function toMRSRegistrationSummaryForm(
  v: MRSRegistrationSummary,
): MRSRegistrationSummaryForm {
  return applyDefaultValues(v, MRSRegistrationSummarySchema);
}

export interface MRSTUPAcknowledgeServiceForm {
  acknowledged: boolean;
}

export const MRSTUPAcknowledgeServiceSchema = buildSchema<
  MRSTUPAcknowledgeServiceForm,
  "File"
>({
  acknowledged: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Acknowledged",
  }),
});

export const defaultMRSTUPAcknowledgeServiceForm: MRSTUPAcknowledgeServiceForm =
  defaultValueForFields(MRSTUPAcknowledgeServiceSchema);

export function toMRSTUPAcknowledgeServiceForm(
  v: MRSTUPAcknowledgeService,
): MRSTUPAcknowledgeServiceForm {
  return applyDefaultValues(v, MRSTUPAcknowledgeServiceSchema);
}

export interface TUPSummaryForm {
  id: string;
  status: TUPStatus;
  receiptNumber: string | null;
  vehicleDescription: string | null;
  plateNumber: string | null;
  currentClassification: string | null;
  toClassification: string | null;
  startDate: string | null;
  endDate: string | null;
}

export const TUPSummarySchema = buildSchema<TUPSummaryForm, "File">({
  id: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  status: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Status",
    options: [
      {
        name: "Draft",
        value: "Draft",
      },
      {
        name: "Submitted",
        value: "Submitted",
      },
    ],
  }),
  receiptNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Receipt Number",
  }),
  vehicleDescription: makeScalarField({
    type: FieldType.String,
    displayName: "Vehicle Description",
  }),
  plateNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Plate Number",
  }),
  currentClassification: makeScalarField({
    type: FieldType.String,
    displayName: "Current Classification",
  }),
  toClassification: makeScalarField({
    type: FieldType.String,
    displayName: "To Classification",
  }),
  startDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Start Date",
  }),
  endDate: makeScalarField({
    type: FieldType.Date,
    displayName: "End Date",
  }),
});

export const defaultTUPSummaryForm: TUPSummaryForm =
  defaultValueForFields(TUPSummarySchema);

export function toTUPSummaryForm(v: TUPSummary): TUPSummaryForm {
  return applyDefaultValues(v, TUPSummarySchema);
}

export interface MrsRegistrationSummaryForm {
  id: number | null;
  plateNumber: string | null;
  description: string;
  isRegistered: boolean;
  isSuspended: boolean;
  renewalAvailable: boolean | null;
  transferPending: boolean | null;
  hasDefects: boolean | null;
  isExpired: boolean | null;
  expiryDate: string | null;
  expiresSoon: boolean | null;
}

export const MrsRegistrationSummarySchema = buildSchema<
  MrsRegistrationSummaryForm,
  "File"
>({
  id: makeScalarField({
    type: FieldType.Int,
    displayName: "Id",
  }),
  plateNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Plate Number",
  }),
  description: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Description",
  }),
  isRegistered: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Registered",
  }),
  isSuspended: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Suspended",
  }),
  renewalAvailable: makeScalarField({
    type: FieldType.Bool,
    displayName: "Renewal Available",
  }),
  transferPending: makeScalarField({
    type: FieldType.Bool,
    displayName: "Transfer Pending",
  }),
  hasDefects: makeScalarField({
    type: FieldType.Bool,
    displayName: "Has Defects",
  }),
  isExpired: makeScalarField({
    type: FieldType.Bool,
    displayName: "Is Expired",
  }),
  expiryDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Expiry Date",
  }),
  expiresSoon: makeScalarField({
    type: FieldType.Bool,
    displayName: "Expires Soon",
  }),
});

export const defaultMrsRegistrationSummaryForm: MrsRegistrationSummaryForm =
  defaultValueForFields(MrsRegistrationSummarySchema);

export function toMrsRegistrationSummaryForm(
  v: MrsRegistrationSummary,
): MrsRegistrationSummaryForm {
  return applyDefaultValues(v, MrsRegistrationSummarySchema);
}

export interface MrsLicenceClassForm {
  header: string | null;
  statusDescription: string | null;
  expiryDate: string | null;
  expiresSoon: boolean;
  cantRenewOnline: boolean;
  cantRenewOnlineReason: string | null;
  isLearner: boolean;
  upgradesTo: string | null;
  upgradesOn: string | null;
}

export const MrsLicenceClassSchema = buildSchema<MrsLicenceClassForm, "File">({
  header: makeScalarField({
    type: FieldType.String,
    displayName: "Header",
  }),
  statusDescription: makeScalarField({
    type: FieldType.String,
    displayName: "Status Description",
  }),
  expiryDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Expiry Date",
  }),
  expiresSoon: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Expires Soon",
  }),
  cantRenewOnline: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Cant Renew Online",
  }),
  cantRenewOnlineReason: makeScalarField({
    type: FieldType.String,
    displayName: "Cant Renew Online Reason",
  }),
  isLearner: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Learner",
  }),
  upgradesTo: makeScalarField({
    type: FieldType.String,
    displayName: "Upgrades To",
  }),
  upgradesOn: makeScalarField({
    type: FieldType.Date,
    displayName: "Upgrades On",
  }),
});

export const defaultMrsLicenceClassForm: MrsLicenceClassForm =
  defaultValueForFields(MrsLicenceClassSchema);

export function toMrsLicenceClassForm(v: MrsLicenceClass): MrsLicenceClassForm {
  return applyDefaultValues(v, MrsLicenceClassSchema);
}

export interface MrsLicenceSummaryAppForm {
  licenceId: number | null;
  clientId: number | null;
  testPassed: boolean;
  hasLicence: boolean;
  showPreLearnerCard: boolean;
  driver: MrsLicenceClassForm | null;
  rider: MrsLicenceClassForm | null;
}

export const MrsLicenceSummarySchema = buildSchema<
  MrsLicenceSummaryAppForm,
  "File"
>({
  licenceId: makeScalarField({
    type: FieldType.Int,
    displayName: "Licence Id",
  }),
  clientId: makeScalarField({
    type: FieldType.Int,
    displayName: "Client Id",
  }),
  testPassed: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Test Passed",
  }),
  hasLicence: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Has Licence",
  }),
  showPreLearnerCard: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Show Pre Learner Card",
  }),
  driver: makeCompoundField({
    children: MrsLicenceClassSchema,
    schemaRef: "MrsLicenceClass",
    displayName: "Driver",
  }),
  rider: makeCompoundField({
    children: MrsLicenceClassSchema,
    schemaRef: "MrsLicenceClass",
    displayName: "Rider",
  }),
});

export const defaultMrsLicenceSummaryAppForm: MrsLicenceSummaryAppForm =
  defaultValueForFields(MrsLicenceSummarySchema);

export function toMrsLicenceSummaryAppForm(
  v: MrsLicenceSummary,
): MrsLicenceSummaryAppForm {
  return applyDefaultValues(v, MrsLicenceSummarySchema);
}

export interface MrsDemeritsDetailForm {
  points: number | null;
  offenceDate: string | null;
  description: string;
}

export const MrsDemeritsDetailSchema = buildSchema<
  MrsDemeritsDetailForm,
  "File"
>({
  points: makeScalarField({
    type: FieldType.Int,
    displayName: "Points",
  }),
  offenceDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Offence Date",
  }),
  description: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Description",
  }),
});

export const defaultMrsDemeritsDetailForm: MrsDemeritsDetailForm =
  defaultValueForFields(MrsDemeritsDetailSchema);

export function toMrsDemeritsDetailForm(
  v: MrsDemeritsDetail,
): MrsDemeritsDetailForm {
  return applyDefaultValues(v, MrsDemeritsDetailSchema);
}

export interface MrsDemeritsSummaryAppForm {
  totalPoints: number;
  activePoints: number;
  details: MrsDemeritsDetailForm[];
  drivingHistoryRequestedMessage: string | null;
  requestHistoryErrorMessage: string | null;
}

export const MrsDemeritsSummarySchema = buildSchema<
  MrsDemeritsSummaryAppForm,
  "File"
>({
  totalPoints: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Total Points",
  }),
  activePoints: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Active Points",
  }),
  details: makeCompoundField({
    children: MrsDemeritsDetailSchema,
    schemaRef: "MrsDemeritsDetail",
    collection: true,
    notNullable: true,
    displayName: "Details",
  }),
  drivingHistoryRequestedMessage: makeScalarField({
    type: FieldType.String,
    displayName: "Driving History Requested Message",
  }),
  requestHistoryErrorMessage: makeScalarField({
    type: FieldType.String,
    displayName: "Request History Error Message",
  }),
});

export const defaultMrsDemeritsSummaryAppForm: MrsDemeritsSummaryAppForm =
  defaultValueForFields(MrsDemeritsSummarySchema);

export function toMrsDemeritsSummaryAppForm(
  v: MrsDemeritsSummary,
): MrsDemeritsSummaryAppForm {
  return applyDefaultValues(v, MrsDemeritsSummarySchema);
}

export interface MrsSummaryForm {
  registrations: MrsRegistrationSummaryForm[];
  licence: MrsLicenceSummaryAppForm;
  demerits: MrsDemeritsSummaryAppForm;
}

export const MrsSummaryFormSchema = buildSchema<MrsSummaryForm, "File">({
  registrations: makeCompoundField({
    children: MrsRegistrationSummarySchema,
    schemaRef: "MrsRegistrationSummary",
    collection: true,
    notNullable: true,
    displayName: "Registrations",
  }),
  licence: makeCompoundField({
    children: MrsLicenceSummarySchema,
    schemaRef: "MrsLicenceSummary",
    notNullable: true,
    displayName: "Licence",
  }),
  demerits: makeCompoundField({
    children: MrsDemeritsSummarySchema,
    schemaRef: "MrsDemeritsSummary",
    notNullable: true,
    displayName: "Demerits",
  }),
});

export const defaultMrsSummaryForm: MrsSummaryForm =
  defaultValueForFields(MrsSummaryFormSchema);

export interface MastRenewalSummaryForm {
  renewalNumber: string | null;
  ivrReferenceNumber: string | null;
  amountOwing: number;
  isOverdue: boolean;
  renewalUrl: string | null;
}

export const MastRenewalSummarySchema = buildSchema<
  MastRenewalSummaryForm,
  "File"
>({
  renewalNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Renewal Number",
  }),
  ivrReferenceNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Ivr Reference Number",
  }),
  amountOwing: makeScalarField({
    type: FieldType.Double,
    notNullable: true,
    required: true,
    displayName: "Amount Owing",
  }),
  isOverdue: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Overdue",
  }),
  renewalUrl: makeScalarField({
    type: FieldType.String,
    displayName: "Renewal Url",
  }),
});

export const defaultMastRenewalSummaryForm: MastRenewalSummaryForm =
  defaultValueForFields(MastRenewalSummarySchema);

export function toMastRenewalSummaryForm(
  v: MastRenewalSummary,
): MastRenewalSummaryForm {
  return applyDefaultValues(v, MastRenewalSummarySchema);
}

export interface MastLicenceSummaryAppForm {
  licenceNumber: string | null;
  citizenId: string | null;
  expiryDate: string | null;
  expiresSoon: boolean;
  cantRenewOnline: boolean;
  isProvisional: boolean;
  requiresVisualAids: boolean;
  hasEyesightColourDeficiency: boolean;
  isPwcEndorsed: boolean;
  pendingRenewal: MastRenewalSummaryForm | null;
}

export const MastLicenceSummarySchema = buildSchema<
  MastLicenceSummaryAppForm,
  "File"
>({
  licenceNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Licence Number",
  }),
  citizenId: makeScalarField({
    type: FieldType.String,
    displayName: "Citizen Id",
  }),
  expiryDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Expiry Date",
  }),
  expiresSoon: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Expires Soon",
  }),
  cantRenewOnline: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Cant Renew Online",
  }),
  isProvisional: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Provisional",
  }),
  requiresVisualAids: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Requires Visual Aids",
  }),
  hasEyesightColourDeficiency: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Has Eyesight Colour Deficiency",
  }),
  isPwcEndorsed: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Pwc Endorsed",
  }),
  pendingRenewal: makeCompoundField({
    children: MastRenewalSummarySchema,
    schemaRef: "MastRenewalSummary",
    displayName: "Pending Renewal",
  }),
});

export const defaultMastLicenceSummaryAppForm: MastLicenceSummaryAppForm =
  defaultValueForFields(MastLicenceSummarySchema);

export function toMastLicenceSummaryAppForm(
  v: MastLicenceSummary,
): MastLicenceSummaryAppForm {
  return applyDefaultValues(v, MastLicenceSummarySchema);
}

export interface MastBoatRegistrationSummaryAppForm {
  registrationNumber: string | null;
  personalisedId: string | null;
  vesselName: string | null;
  expiryDate: string | null;
  expiresSoon: boolean;
  cantRenewOnline: boolean;
  isRegistered: boolean;
  isSuspended: boolean;
  vesselType: string | null;
  vesselLength: number | null;
  manufacturer: string | null;
  colour: string | null;
  registeredOperatorType: RegisteredOperatorType | null;
  registeredOperator: string | null;
  secondaryOperator: string | null;
  organisationContact: string | null;
  pendingRenewal: MastRenewalSummaryForm | null;
}

export const MastRegistrationSummarySchema = buildSchema<
  MastBoatRegistrationSummaryAppForm,
  "File"
>({
  registrationNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Registration Number",
  }),
  personalisedId: makeScalarField({
    type: FieldType.String,
    displayName: "Personalised Id",
  }),
  vesselName: makeScalarField({
    type: FieldType.String,
    displayName: "Vessel Name",
  }),
  expiryDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Expiry Date",
  }),
  expiresSoon: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Expires Soon",
  }),
  cantRenewOnline: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Cant Renew Online",
  }),
  isRegistered: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Registered",
  }),
  isSuspended: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Suspended",
  }),
  vesselType: makeScalarField({
    type: FieldType.String,
    displayName: "Vessel Type",
  }),
  vesselLength: makeScalarField({
    type: FieldType.Double,
    displayName: "Vessel Length",
  }),
  manufacturer: makeScalarField({
    type: FieldType.String,
    displayName: "Manufacturer",
  }),
  colour: makeScalarField({
    type: FieldType.String,
    displayName: "Colour",
  }),
  registeredOperatorType: makeScalarField({
    type: FieldType.String,
    displayName: "Registered Operator Type",
    options: [
      {
        name: "Individual",
        value: "Individual",
      },
      {
        name: "Organisation",
        value: "Organisation",
      },
    ],
  }),
  registeredOperator: makeScalarField({
    type: FieldType.String,
    displayName: "Registered Operator",
  }),
  secondaryOperator: makeScalarField({
    type: FieldType.String,
    displayName: "Secondary Operator",
  }),
  organisationContact: makeScalarField({
    type: FieldType.String,
    displayName: "Organisation Contact",
  }),
  pendingRenewal: makeCompoundField({
    children: MastRenewalSummarySchema,
    schemaRef: "MastRenewalSummary",
    displayName: "Pending Renewal",
  }),
});

export const defaultMastBoatRegistrationSummaryAppForm: MastBoatRegistrationSummaryAppForm =
  defaultValueForFields(MastRegistrationSummarySchema);

export function toMastBoatRegistrationSummaryAppForm(
  v: MastRegistrationSummary,
): MastBoatRegistrationSummaryAppForm {
  return applyDefaultValues(v, MastRegistrationSummarySchema);
}

export interface PointForm {
  lat: number;
  lng: number;
}

export const PointSchema = buildSchema<PointForm, "File">({
  lat: makeScalarField({
    type: FieldType.Double,
    notNullable: true,
    required: true,
    displayName: "Lat",
  }),
  lng: makeScalarField({
    type: FieldType.Double,
    notNullable: true,
    required: true,
    displayName: "Lng",
  }),
});

export const defaultPointForm: PointForm = defaultValueForFields(PointSchema);

export function toPointForm(v: Point): PointForm {
  return applyDefaultValues(v, PointSchema);
}

export interface MastMooringPermitSummaryAppForm {
  permitNumber: string | null;
  expiryDate: string | null;
  expiresSoon: boolean;
  cantRenewOnline: boolean;
  isSuspended: boolean;
  location: string | null;
  approvedLength: number | null;
  isTransferable: boolean;
  locationPoint: PointForm | null;
  pendingRenewal: MastRenewalSummaryForm | null;
}

export const MastMooringPermitSummarySchema = buildSchema<
  MastMooringPermitSummaryAppForm,
  "File"
>({
  permitNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Permit Number",
  }),
  expiryDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Expiry Date",
  }),
  expiresSoon: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Expires Soon",
  }),
  cantRenewOnline: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Cant Renew Online",
  }),
  isSuspended: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Suspended",
  }),
  location: makeScalarField({
    type: FieldType.String,
    displayName: "Location",
  }),
  approvedLength: makeScalarField({
    type: FieldType.Double,
    displayName: "Approved Length",
  }),
  isTransferable: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Transferable",
  }),
  locationPoint: makeCompoundField({
    children: PointSchema,
    schemaRef: "Point",
    displayName: "Location Point",
  }),
  pendingRenewal: makeCompoundField({
    children: MastRenewalSummarySchema,
    schemaRef: "MastRenewalSummary",
    displayName: "Pending Renewal",
  }),
});

export const defaultMastMooringPermitSummaryAppForm: MastMooringPermitSummaryAppForm =
  defaultValueForFields(MastMooringPermitSummarySchema);

export function toMastMooringPermitSummaryAppForm(
  v: MastMooringPermitSummary,
): MastMooringPermitSummaryAppForm {
  return applyDefaultValues(v, MastMooringPermitSummarySchema);
}

export interface MastCommercialVesselSummaryAppForm {
  amsaUvi: string | null;
  expiryDate: string | null;
  expiresSoon: boolean;
  isSuspended: boolean;
  vesselName: string | null;
  vesselLength: number | null;
}

export const MastCommercialVesselSummarySchema = buildSchema<
  MastCommercialVesselSummaryAppForm,
  "File"
>({
  amsaUvi: makeScalarField({
    type: FieldType.String,
    displayName: "Amsa Uvi",
  }),
  expiryDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Expiry Date",
  }),
  expiresSoon: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Expires Soon",
  }),
  isSuspended: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Suspended",
  }),
  vesselName: makeScalarField({
    type: FieldType.String,
    displayName: "Vessel Name",
  }),
  vesselLength: makeScalarField({
    type: FieldType.Double,
    displayName: "Vessel Length",
  }),
});

export const defaultMastCommercialVesselSummaryAppForm: MastCommercialVesselSummaryAppForm =
  defaultValueForFields(MastCommercialVesselSummarySchema);

export function toMastCommercialVesselSummaryAppForm(
  v: MastCommercialVesselSummary,
): MastCommercialVesselSummaryAppForm {
  return applyDefaultValues(v, MastCommercialVesselSummarySchema);
}

export interface MastSummaryForm {
  licences: MastLicenceSummaryAppForm;
  boatRegistrations: MastBoatRegistrationSummaryAppForm[];
  mooringPermits: MastMooringPermitSummaryAppForm[];
  commercialVessels: MastCommercialVesselSummaryAppForm[];
}

export const MastSummaryFormSchema = buildSchema<MastSummaryForm, "File">({
  licences: makeCompoundField({
    children: MastLicenceSummarySchema,
    schemaRef: "MastLicenceSummary",
    notNullable: true,
    displayName: "Licences",
  }),
  boatRegistrations: makeCompoundField({
    children: MastRegistrationSummarySchema,
    schemaRef: "MastRegistrationSummary",
    collection: true,
    notNullable: true,
    displayName: "Boat Registrations",
  }),
  mooringPermits: makeCompoundField({
    children: MastMooringPermitSummarySchema,
    schemaRef: "MastMooringPermitSummary",
    collection: true,
    notNullable: true,
    displayName: "Mooring Permits",
  }),
  commercialVessels: makeCompoundField({
    children: MastCommercialVesselSummarySchema,
    schemaRef: "MastCommercialVesselSummary",
    collection: true,
    notNullable: true,
    displayName: "Commercial Vessels",
  }),
});

export const defaultMastSummaryForm: MastSummaryForm = defaultValueForFields(
  MastSummaryFormSchema,
);

export interface MrsLicenceMedicalCheckForm {
  medicalCheckExpiring: boolean;
  medicalCheckExpired: boolean;
  medicalCheckDate: string | null;
}

export const MrsLicenceMedicalCheckSchema = buildSchema<
  MrsLicenceMedicalCheckForm,
  "File"
>({
  medicalCheckExpiring: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Medical Check Expiring",
  }),
  medicalCheckExpired: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Medical Check Expired",
  }),
  medicalCheckDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Medical Check Date",
  }),
});

export const defaultMrsLicenceMedicalCheckForm: MrsLicenceMedicalCheckForm =
  defaultValueForFields(MrsLicenceMedicalCheckSchema);

export function toMrsLicenceMedicalCheckForm(
  v: MrsLicenceMedicalCheck,
): MrsLicenceMedicalCheckForm {
  return applyDefaultValues(v, MrsLicenceMedicalCheckSchema);
}

export interface MrsLicenceConditionForm {
  conditionSummary: string;
  conditionDescriptions: string[];
}

export const MrsLicenceConditionSchema = buildSchema<
  MrsLicenceConditionForm,
  "File"
>({
  conditionSummary: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Condition Summary",
  }),
  conditionDescriptions: makeScalarField({
    type: FieldType.String,
    collection: true,
    notNullable: true,
    displayName: "Condition Descriptions",
  }),
});

export const defaultMrsLicenceConditionForm: MrsLicenceConditionForm =
  defaultValueForFields(MrsLicenceConditionSchema);

export function toMrsLicenceConditionForm(
  v: MrsLicenceCondition,
): MrsLicenceConditionForm {
  return applyDefaultValues(v, MrsLicenceConditionSchema);
}

export interface MrsLicenceDetailsClassForm {
  expiresSoon: boolean;
  cantRenewOnline: boolean;
  renewalAvailable: boolean;
  expiryDate: string | null;
  statusDescription: string | null;
  classCode: string | null;
}

export const MrsLicenceDetailsClassSchema = buildSchema<
  MrsLicenceDetailsClassForm,
  "File"
>({
  expiresSoon: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Expires Soon",
  }),
  cantRenewOnline: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Cant Renew Online",
  }),
  renewalAvailable: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Renewal Available",
  }),
  expiryDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Expiry Date",
  }),
  statusDescription: makeScalarField({
    type: FieldType.String,
    displayName: "Status Description",
  }),
  classCode: makeScalarField({
    type: FieldType.String,
    displayName: "Class Code",
  }),
});

export const defaultMrsLicenceDetailsClassForm: MrsLicenceDetailsClassForm =
  defaultValueForFields(MrsLicenceDetailsClassSchema);

export function toMrsLicenceDetailsClassForm(
  v: MrsLicenceDetailsClass,
): MrsLicenceDetailsClassForm {
  return applyDefaultValues(v, MrsLicenceDetailsClassSchema);
}

export interface MrsLicenceDetailsForm {
  licenceType: MrsLicenceType;
  licenceNumber: string;
  cardNumber: string;
  address: string | null;
  medicalCheckInformation: MrsLicenceMedicalCheckForm | null;
  condition: MrsLicenceConditionForm | null;
  class: MrsLicenceDetailsClassForm | null;
  ancillaryCertificates: string[];
  hasConcessions: boolean;
  upgradesTo: string | null;
  upgradesOn: string | null;
}

export const MrsLicenceDetailsFormSchema = buildSchema<
  MrsLicenceDetailsForm,
  "File"
>({
  licenceType: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Licence Type",
    options: [
      {
        name: "Driver",
        value: "Driver",
      },
      {
        name: "Rider",
        value: "Rider",
      },
    ],
  }),
  licenceNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Licence Number",
  }),
  cardNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Card Number",
  }),
  address: makeScalarField({
    type: FieldType.String,
    displayName: "Address",
  }),
  medicalCheckInformation: makeCompoundField({
    children: MrsLicenceMedicalCheckSchema,
    schemaRef: "MrsLicenceMedicalCheck",
    displayName: "Medical Check Information",
  }),
  condition: makeCompoundField({
    children: MrsLicenceConditionSchema,
    schemaRef: "MrsLicenceCondition",
    displayName: "Condition",
  }),
  class: makeCompoundField({
    children: MrsLicenceDetailsClassSchema,
    schemaRef: "MrsLicenceDetailsClass",
    displayName: "Class",
  }),
  ancillaryCertificates: makeScalarField({
    type: FieldType.String,
    collection: true,
    notNullable: true,
    displayName: "Ancillary Certificates",
  }),
  hasConcessions: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Has Concessions",
  }),
  upgradesTo: makeScalarField({
    type: FieldType.String,
    displayName: "Upgrades To",
  }),
  upgradesOn: makeScalarField({
    type: FieldType.Date,
    displayName: "Upgrades On",
  }),
});

export const defaultMrsLicenceDetailsForm: MrsLicenceDetailsForm =
  defaultValueForFields(MrsLicenceDetailsFormSchema);

export interface MrsRegistrationStatusForm {
  isSuspended: boolean;
  isRegistered: boolean;
  renewalAvailable: boolean | null;
  transferPending: boolean | null;
  hasDefects: boolean | null;
  isVehicleStolen: boolean | null;
  isVehicleStatutoryWriteOff: boolean | null;
  isVehicleRepairableWriteOff: boolean | null;
}

export const MrsRegistrationStatusSchema = buildSchema<
  MrsRegistrationStatusForm,
  "File"
>({
  isSuspended: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Suspended",
  }),
  isRegistered: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Registered",
  }),
  renewalAvailable: makeScalarField({
    type: FieldType.Bool,
    displayName: "Renewal Available",
  }),
  transferPending: makeScalarField({
    type: FieldType.Bool,
    displayName: "Transfer Pending",
  }),
  hasDefects: makeScalarField({
    type: FieldType.Bool,
    displayName: "Has Defects",
  }),
  isVehicleStolen: makeScalarField({
    type: FieldType.Bool,
    displayName: "Is Vehicle Stolen",
  }),
  isVehicleStatutoryWriteOff: makeScalarField({
    type: FieldType.Bool,
    displayName: "Is Vehicle Statutory Write Off",
  }),
  isVehicleRepairableWriteOff: makeScalarField({
    type: FieldType.Bool,
    displayName: "Is Vehicle Repairable Write Off",
  }),
});

export const defaultMrsRegistrationStatusForm: MrsRegistrationStatusForm =
  defaultValueForFields(MrsRegistrationStatusSchema);

export function toMrsRegistrationStatusForm(
  v: MrsRegistrationStatus,
): MrsRegistrationStatusForm {
  return applyDefaultValues(v, MrsRegistrationStatusSchema);
}

export interface MrsRegistrationVehicleInformationForm {
  tpiDescription: string;
  year: string;
  expiryDate: string | null;
  vehicleType: string;
  vin: string;
  engineNumber: string;
  isElectric: boolean;
  motorKWs: number | null;
  cylinderCount: string | null;
  engineCapacity: number | null;
  nominatedOperator: string | null;
  otherOperator: string | null;
}

export const MrsRegistrationVehicleInformationSchema = buildSchema<
  MrsRegistrationVehicleInformationForm,
  "File"
>({
  tpiDescription: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Tpi Description",
  }),
  year: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Year",
  }),
  expiryDate: makeScalarField({
    type: FieldType.String,
    displayName: "Expiry Date",
  }),
  vehicleType: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Vehicle Type",
  }),
  vin: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Vin",
  }),
  engineNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Engine Number",
  }),
  isElectric: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Electric",
  }),
  motorKWs: makeScalarField({
    type: FieldType.Int,
    displayName: "MotorK Ws",
  }),
  cylinderCount: makeScalarField({
    type: FieldType.String,
    displayName: "Cylinder Count",
  }),
  engineCapacity: makeScalarField({
    type: FieldType.Int,
    displayName: "Engine Capacity",
  }),
  nominatedOperator: makeScalarField({
    type: FieldType.String,
    displayName: "Nominated Operator",
  }),
  otherOperator: makeScalarField({
    type: FieldType.String,
    displayName: "Other Operator",
  }),
});

export const defaultMrsRegistrationVehicleInformationForm: MrsRegistrationVehicleInformationForm =
  defaultValueForFields(MrsRegistrationVehicleInformationSchema);

export function toMrsRegistrationVehicleInformationForm(
  v: MrsRegistrationVehicleInformation,
): MrsRegistrationVehicleInformationForm {
  return applyDefaultValues(v, MrsRegistrationVehicleInformationSchema);
}

export interface MrsRegistrationDefectForm {
  comment: string;
  date: string | null;
}

export const MrsRegistrationDefectSchema = buildSchema<
  MrsRegistrationDefectForm,
  "File"
>({
  comment: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Comment",
  }),
  date: makeScalarField({
    type: FieldType.String,
    displayName: "Date",
  }),
});

export const defaultMrsRegistrationDefectForm: MrsRegistrationDefectForm =
  defaultValueForFields(MrsRegistrationDefectSchema);

export function toMrsRegistrationDefectForm(
  v: MrsRegistrationDefect,
): MrsRegistrationDefectForm {
  return applyDefaultValues(v, MrsRegistrationDefectSchema);
}

export interface MrsRegistrationDetailsForm {
  id: number | null;
  plateNumber: string | null;
  description: string;
  registrationStatus: MrsRegistrationStatusForm;
  vehicleInformation: MrsRegistrationVehicleInformationForm;
  conditions: string[];
  hasConcessions: boolean;
  defects: MrsRegistrationDefectForm[];
}

export const MrsRegistrationDetailsFormSchema = buildSchema<
  MrsRegistrationDetailsForm,
  "File"
>({
  id: makeScalarField({
    type: FieldType.Int,
    displayName: "Id",
  }),
  plateNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Plate Number",
  }),
  description: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Description",
  }),
  registrationStatus: makeCompoundField({
    children: MrsRegistrationStatusSchema,
    schemaRef: "MrsRegistrationStatus",
    notNullable: true,
    displayName: "Registration Status",
  }),
  vehicleInformation: makeCompoundField({
    children: MrsRegistrationVehicleInformationSchema,
    schemaRef: "MrsRegistrationVehicleInformation",
    notNullable: true,
    displayName: "Vehicle Information",
  }),
  conditions: makeScalarField({
    type: FieldType.String,
    collection: true,
    notNullable: true,
    displayName: "Conditions",
  }),
  hasConcessions: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Has Concessions",
  }),
  defects: makeCompoundField({
    children: MrsRegistrationDefectSchema,
    schemaRef: "MrsRegistrationDefect",
    collection: true,
    notNullable: true,
    displayName: "Defects",
  }),
});

export const defaultMrsRegistrationDetailsForm: MrsRegistrationDetailsForm =
  defaultValueForFields(MrsRegistrationDetailsFormSchema);

export interface MyAccountForm {
  appVersion: string | null;
}

export const MyAccountFormSchema = buildSchema<MyAccountForm, "File">({
  appVersion: makeScalarField({
    type: FieldType.String,
    displayName: "App Version",
  }),
});

export const defaultMyAccountForm: MyAccountForm =
  defaultValueForFields(MyAccountFormSchema);

export interface MyProfileForm {}

export const MyProfileFormSchema = buildSchema<MyProfileForm, "File">({});

export const defaultMyProfileForm: MyProfileForm =
  defaultValueForFields(MyProfileFormSchema);

export interface AccountPreferencesForm {}

export const AccountPreferencesFormSchema = buildSchema<
  AccountPreferencesForm,
  "File"
>({});

export const defaultAccountPreferencesForm: AccountPreferencesForm =
  defaultValueForFields(AccountPreferencesFormSchema);

export interface PersonalDetailsForm {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  birthDate: string | null;
}

export const PersonalDetailsSchema = buildSchema<PersonalDetailsForm, "File">({
  firstName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "First Name",
  }),
  lastName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Last Name",
  }),
  preferredName: makeScalarField({
    type: FieldType.String,
    displayName: "Preferred Name",
  }),
  birthDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Birth Date",
  }),
});

export const defaultPersonalDetailsForm: PersonalDetailsForm =
  defaultValueForFields(PersonalDetailsSchema);

export function toPersonalDetailsForm(v: PersonalDetails): PersonalDetailsForm {
  return applyDefaultValues(v, PersonalDetailsSchema);
}

export interface AccountDetailsForm {
  email: string;
  mobileNumber: string;
  alternativeContactNumber: string | null;
}

export const AccountDetailsFormSchema = buildSchema<AccountDetailsForm, "File">(
  {
    email: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Email",
    }),
    mobileNumber: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Mobile Number",
    }),
    alternativeContactNumber: makeScalarField({
      type: FieldType.String,
      displayName: "Alternative Contact Number",
    }),
  },
);

export const defaultAccountDetailsForm: AccountDetailsForm =
  defaultValueForFields(AccountDetailsFormSchema);

export interface AddressDetailsEditForm {
  addressSearch: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string | null;
}

export const AddressDetailsEditSchema = buildSchema<
  AddressDetailsEditForm,
  "File"
>({
  addressSearch: makeScalarField({
    type: FieldType.String,
    displayName: "Address Search",
  }),
  addressLine1: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Address Line1",
  }),
  addressLine2: makeScalarField({
    type: FieldType.String,
    displayName: "Address Line2",
  }),
  city: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "City",
  }),
  state: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "State",
  }),
  postalCode: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Postal Code",
  }),
  country: makeScalarField({
    type: FieldType.String,
    displayName: "Country",
  }),
});

export const defaultAddressDetailsEditForm: AddressDetailsEditForm =
  defaultValueForFields(AddressDetailsEditSchema);

export function toAddressDetailsEditForm(
  v: AddressDetailsEdit,
): AddressDetailsEditForm {
  return applyDefaultValues(v, AddressDetailsEditSchema);
}

export interface AddressEditForm {
  residentialAddressDetails: AddressDetailsEditForm;
  postalAddressDetails: AddressDetailsEditForm | null;
  postalAddressSameAsResidentialAddress: boolean | null;
}

export const AddressEditSchema = buildSchema<AddressEditForm, "File">({
  residentialAddressDetails: makeCompoundField({
    children: AddressDetailsEditSchema,
    schemaRef: "AddressDetailsEdit",
    notNullable: true,
    displayName: "Residential Address Details",
  }),
  postalAddressDetails: makeCompoundField({
    children: AddressDetailsEditSchema,
    schemaRef: "AddressDetailsEdit",
    displayName: "Postal Address Details",
  }),
  postalAddressSameAsResidentialAddress: makeScalarField({
    type: FieldType.Bool,
    displayName: "Postal Address Same As Residential Address",
  }),
});

export const defaultAddressEditForm: AddressEditForm =
  defaultValueForFields(AddressEditSchema);

export function toAddressEditForm(v: AddressEdit): AddressEditForm {
  return applyDefaultValues(v, AddressEditSchema);
}

export interface AddressForm {
  addressEdit: AddressEditForm;
}

export const AddressFormSchema = buildSchema<AddressForm, "File">({
  addressEdit: makeCompoundField({
    children: AddressEditSchema,
    schemaRef: "AddressEdit",
    notNullable: true,
    displayName: "Address Edit",
  }),
});

export const defaultAddressForm: AddressForm =
  defaultValueForFields(AddressFormSchema);

export interface NotificationPreferencesForm {
  messageDeliveryMethod: Tas_messagedeliverymethods | null;
  sendSecureNotification: boolean;
  pushNotifications: boolean | null;
}

export const NotificationPreferencesSchema = buildSchema<
  NotificationPreferencesForm,
  "File"
>({
  messageDeliveryMethod: makeScalarField({
    type: FieldType.Int,
    displayName: "Message Delivery Method",
    options: [
      {
        name: "Email",
        value: 928220000,
      },
      {
        name: "SMS",
        value: 928220001,
      },
    ],
  }),
  sendSecureNotification: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Send Secure Notification",
  }),
  pushNotifications: makeScalarField({
    type: FieldType.Bool,
    displayName: "Push Notifications",
  }),
});

export const defaultNotificationPreferencesForm: NotificationPreferencesForm =
  defaultValueForFields(NotificationPreferencesSchema);

export function toNotificationPreferencesForm(
  v: NotificationPreferences,
): NotificationPreferencesForm {
  return applyDefaultValues(v, NotificationPreferencesSchema);
}

export interface SecurityPreferencesForm {
  useBiometrics: boolean;
}

export const SecurityPreferencesFormSchema = buildSchema<
  SecurityPreferencesForm,
  "File"
>({
  useBiometrics: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Use Biometrics",
  }),
});

export const defaultSecurityPreferencesForm: SecurityPreferencesForm =
  defaultValueForFields(SecurityPreferencesFormSchema);

export interface TuoProviderOptionForm {
  id: string;
  serviceProvider: string;
  serviceProviderShortName: string;
  unselectable: boolean;
  notRevoked: boolean;
}

export const TuoProviderOptionSchema = buildSchema<
  TuoProviderOptionForm,
  "File"
>({
  id: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  serviceProvider: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Service Provider",
  }),
  serviceProviderShortName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Service Provider Short Name",
  }),
  unselectable: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Unselectable",
  }),
  notRevoked: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Not Revoked",
  }),
});

export const defaultTuoProviderOptionForm: TuoProviderOptionForm =
  defaultValueForFields(TuoProviderOptionSchema);

export function toTuoProviderOptionForm(
  v: TuoProviderOption,
): TuoProviderOptionForm {
  return applyDefaultValues(v, TuoProviderOptionSchema);
}

export interface TuoPreferencesForm {
  preferenceOption: TuoPreferenceOption;
  availableOptions: TuoProviderOptionForm[];
  readonlyOptions: TuoProviderOptionForm[];
}

export const TuoPreferencesSchema = buildSchema<TuoPreferencesForm, "File">({
  preferenceOption: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Preference Option",
    options: [
      {
        name: "All participating services",
        value: "All",
      },
      {
        name: "Only specific services",
        value: "Specific",
      },
    ],
  }),
  availableOptions: makeCompoundField({
    children: TuoProviderOptionSchema,
    schemaRef: "TuoProviderOption",
    collection: true,
    notNullable: true,
    displayName: "Available Options",
  }),
  readonlyOptions: makeCompoundField({
    children: TuoProviderOptionSchema,
    schemaRef: "TuoProviderOption",
    collection: true,
    notNullable: true,
    displayName: "Readonly Options",
  }),
});

export const defaultTuoPreferencesForm: TuoPreferencesForm =
  defaultValueForFields(TuoPreferencesSchema);

export function toTuoPreferencesForm(v: TuoPreferences): TuoPreferencesForm {
  return applyDefaultValues(v, TuoPreferencesSchema);
}

export interface ServiceProviderListingForm {
  serviceProviders: SerProviderForm[];
}

export const ServiceProviderListingFormSchema = buildSchema<
  ServiceProviderListingForm,
  "File"
>({
  serviceProviders: makeCompoundField({
    children: SerProviderSchema,
    schemaRef: "SerProvider",
    collection: true,
    notNullable: true,
    displayName: "Service Providers",
  }),
});

export const defaultServiceProviderListingForm: ServiceProviderListingForm =
  defaultValueForFields(ServiceProviderListingFormSchema);

export interface LinkedServicesForm {
  serviceProviders: SerProviderForm[];
}

export const LinkedServicesFormSchema = buildSchema<LinkedServicesForm, "File">(
  {
    serviceProviders: makeCompoundField({
      children: SerProviderSchema,
      schemaRef: "SerProvider",
      collection: true,
      notNullable: true,
      displayName: "Service Providers",
    }),
  },
);

export const defaultLinkedServicesForm: LinkedServicesForm =
  defaultValueForFields(LinkedServicesFormSchema);

export interface HomeForm {
  displayName: string | null;
  tasks: ApplicationTaskForm[] | null;
  serviceProviders: SerProviderForm[] | null;
}

export const HomeFormSchema = buildSchema<HomeForm, "File">({
  displayName: makeScalarField({
    type: FieldType.String,
    displayName: "Display Name",
  }),
  tasks: makeCompoundField({
    children: ApplicationTaskSchema,
    schemaRef: "ApplicationTask",
    collection: true,
    displayName: "Tasks",
  }),
  serviceProviders: makeCompoundField({
    children: SerProviderSchema,
    schemaRef: "SerProvider",
    collection: true,
    displayName: "Service Providers",
  }),
});

export const defaultHomeForm: HomeForm = defaultValueForFields(HomeFormSchema);

export interface PopularServiceForm {
  name: string;
  shortName: string;
  actionId: string;
  icon: string | null;
}

export const PopularServiceSchema = buildSchema<PopularServiceForm, "File">({
  name: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Name",
  }),
  shortName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Short Name",
  }),
  actionId: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Action Id",
  }),
  icon: makeScalarField({
    type: FieldType.String,
    displayName: "Icon",
  }),
});

export const defaultPopularServiceForm: PopularServiceForm =
  defaultValueForFields(PopularServiceSchema);

export function toPopularServiceForm(v: PopularService): PopularServiceForm {
  return applyDefaultValues(v, PopularServiceSchema);
}

export interface ServicesForm {
  popularServices: PopularServiceForm[];
}

export const ServicesFormSchema = buildSchema<ServicesForm, "File">({
  popularServices: makeCompoundField({
    children: PopularServiceSchema,
    schemaRef: "PopularService",
    collection: true,
    notNullable: true,
    displayName: "Popular Services",
  }),
});

export const defaultServicesForm: ServicesForm =
  defaultValueForFields(ServicesFormSchema);

export interface WalletForm {}

export const WalletFormSchema = buildSchema<WalletForm, "File">({});

export const defaultWalletForm: WalletForm =
  defaultValueForFields(WalletFormSchema);

export interface ServiceNotAvailableForm {
  serviceName: string | null;
}

export const ServiceNotAvailableFormSchema = buildSchema<
  ServiceNotAvailableForm,
  "File"
>({
  serviceName: makeScalarField({
    type: FieldType.String,
    displayName: "Service Name",
  }),
});

export const defaultServiceNotAvailableForm: ServiceNotAvailableForm =
  defaultValueForFields(ServiceNotAvailableFormSchema);

export interface ErrorForm {
  errorCode: string | null;
}

export const ErrorFormSchema = buildSchema<ErrorForm, "File">({
  errorCode: makeScalarField({
    type: FieldType.String,
    displayName: "Error Code",
  }),
});

export const defaultErrorForm: ErrorForm =
  defaultValueForFields(ErrorFormSchema);

export interface TempPaymentForm {
  amount: number;
  availability: PaymentAvailabilityForm;
}

export const TempPaymentFormSchema = buildSchema<TempPaymentForm, "File">({
  amount: makeScalarField({
    type: FieldType.Double,
    notNullable: true,
    required: true,
    displayName: "Amount",
  }),
  availability: makeCompoundField({
    children: PaymentAvailabilitySchema,
    schemaRef: "PaymentAvailability",
    notNullable: true,
    displayName: "Availability",
  }),
});

export const defaultTempPaymentForm: TempPaymentForm = defaultValueForFields(
  TempPaymentFormSchema,
);

export interface PortalMessageDocumentForm {
  id: string;
  fileExtension: string;
  fileSize: string | null;
}

export const PortalMessageDocumentSchema = buildSchema<
  PortalMessageDocumentForm,
  "File"
>({
  id: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  fileExtension: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "File Extension",
  }),
  fileSize: makeScalarField({
    type: FieldType.String,
    displayName: "File Size",
  }),
});

export const defaultPortalMessageDocumentForm: PortalMessageDocumentForm =
  defaultValueForFields(PortalMessageDocumentSchema);

export function toPortalMessageDocumentForm(
  v: PortalMessageDocument,
): PortalMessageDocumentForm {
  return applyDefaultValues(v, PortalMessageDocumentSchema);
}

export interface PortalMessageAppForm {
  id: string;
  title: string;
  body: string;
  issuer: string;
  issueDate: string;
  readDate: string | null;
  deletedDate: string | null;
  document: PortalMessageDocumentForm | null;
  priority: Tas_messagepriority | null;
  type: Tas_message_tas_type | null;
  storageStatus: Tas_storagestatus | null;
}

export const PortalMessageSchema = buildSchema<PortalMessageAppForm, "File">({
  id: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  title: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Title",
  }),
  body: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Body",
  }),
  issuer: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Issuer",
  }),
  issueDate: makeScalarField({
    type: FieldType.Date,
    notNullable: true,
    required: true,
    displayName: "Issue Date",
  }),
  readDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Read Date",
  }),
  deletedDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Deleted Date",
  }),
  document: makeCompoundField({
    children: PortalMessageDocumentSchema,
    schemaRef: "PortalMessageDocument",
    displayName: "Document",
  }),
  priority: makeScalarField({
    type: FieldType.Int,
    displayName: "Priority",
    options: [
      {
        name: "_1High",
        value: 1,
      },
      {
        name: "_2Medium",
        value: 2,
      },
      {
        name: "_3Low",
        value: 3,
      },
    ],
  }),
  type: makeScalarField({
    type: FieldType.Int,
    displayName: "Type",
    options: [
      {
        name: "GenericMessage",
        value: 928220000,
      },
      {
        name: "Alert",
        value: 928220001,
      },
    ],
  }),
  storageStatus: makeScalarField({
    type: FieldType.Int,
    displayName: "Storage Status",
    options: [
      {
        name: "Active",
        value: 928220000,
      },
      {
        name: "Deleted",
        value: 928220001,
      },
      {
        name: "Archived",
        value: 928220002,
      },
    ],
  }),
});

export const defaultPortalMessageAppForm: PortalMessageAppForm =
  defaultValueForFields(PortalMessageSchema);

export function toPortalMessageAppForm(v: PortalMessage): PortalMessageAppForm {
  return applyDefaultValues(v, PortalMessageSchema);
}

export interface PortalMessageForm {
  messages: PortalMessageAppForm[];
}

export const PortalMessageFormSchema = buildSchema<PortalMessageForm, "File">({
  messages: makeCompoundField({
    children: PortalMessageSchema,
    schemaRef: "PortalMessage",
    collection: true,
    notNullable: true,
    displayName: "Messages",
  }),
});

export const defaultPortalMessageForm: PortalMessageForm =
  defaultValueForFields(PortalMessageFormSchema);

export interface PortalMessageDetailsForm {
  message: PortalMessageAppForm;
}

export const PortalMessageDetailsFormSchema = buildSchema<
  PortalMessageDetailsForm,
  "File"
>({
  message: makeCompoundField({
    children: PortalMessageSchema,
    schemaRef: "PortalMessage",
    notNullable: true,
    displayName: "Message",
  }),
});

export const defaultPortalMessageDetailsForm: PortalMessageDetailsForm =
  defaultValueForFields(PortalMessageDetailsFormSchema);

export interface PortalDocumentAppForm {
  id: string;
  issuer: string;
  issueDate: string;
  archivedDate: string;
  readDate: string | null;
  title: string;
  documentType: Tas_documenttype | null;
  storageStatus: Tas_storagestatus | null;
  fileExtension: string;
  fileSize: string | null;
  fileName: string | null;
}

export const PortalDocumentSchema = buildSchema<PortalDocumentAppForm, "File">({
  id: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  issuer: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Issuer",
  }),
  issueDate: makeScalarField({
    type: FieldType.Date,
    notNullable: true,
    required: true,
    displayName: "Issue Date",
  }),
  archivedDate: makeScalarField({
    type: FieldType.Date,
    notNullable: true,
    required: true,
    displayName: "Archived Date",
  }),
  readDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Read Date",
  }),
  title: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Title",
  }),
  documentType: makeScalarField({
    type: FieldType.Int,
    displayName: "Document Type",
    options: [
      {
        name: "Certificate",
        value: 1,
      },
      {
        name: "Licence",
        value: 2,
      },
      {
        name: "Receipt",
        value: 3,
      },
      {
        name: "Notice",
        value: 4,
      },
      {
        name: "Other",
        value: 0,
      },
      {
        name: "Registration",
        value: 5,
      },
    ],
  }),
  storageStatus: makeScalarField({
    type: FieldType.Int,
    displayName: "Storage Status",
    options: [
      {
        name: "Active",
        value: 928220000,
      },
      {
        name: "Deleted",
        value: 928220001,
      },
      {
        name: "Archived",
        value: 928220002,
      },
    ],
  }),
  fileExtension: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "File Extension",
  }),
  fileSize: makeScalarField({
    type: FieldType.String,
    displayName: "File Size",
  }),
  fileName: makeScalarField({
    type: FieldType.String,
    displayName: "File Name",
  }),
});

export const defaultPortalDocumentAppForm: PortalDocumentAppForm =
  defaultValueForFields(PortalDocumentSchema);

export function toPortalDocumentAppForm(
  v: PortalDocument,
): PortalDocumentAppForm {
  return applyDefaultValues(v, PortalDocumentSchema);
}

export interface PortalDocumentForm {
  documents: PortalDocumentAppForm[];
}

export const PortalDocumentFormSchema = buildSchema<PortalDocumentForm, "File">(
  {
    documents: makeCompoundField({
      children: PortalDocumentSchema,
      schemaRef: "PortalDocument",
      collection: true,
      notNullable: true,
      displayName: "Documents",
    }),
  },
);

export const defaultPortalDocumentForm: PortalDocumentForm =
  defaultValueForFields(PortalDocumentFormSchema);

export interface SearchOptionsForm {
  offset: number;
  length: number;
  query: string | null;
  sort: string[] | null;
  filters: any | null;
}

export const SearchOptionsSchema = buildSchema<SearchOptionsForm, "File">({
  offset: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Offset",
  }),
  length: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Length",
  }),
  query: makeScalarField({
    type: FieldType.String,
    displayName: "Query",
  }),
  sort: makeScalarField({
    type: FieldType.String,
    collection: true,
    displayName: "Sort",
  }),
  filters: makeScalarField({
    type: FieldType.Any,
    displayName: "Filters",
  }),
});

export const defaultSearchOptionsForm: SearchOptionsForm =
  defaultValueForFields(SearchOptionsSchema);

export function toSearchOptionsForm(v: SearchOptions): SearchOptionsForm {
  return applyDefaultValues(v, SearchOptionsSchema);
}

export interface SearchMetadataForm {
  singleSort: string;
  recordType: string | null;
  firstIndex: number;
  numberOfEntries: number;
  total: number;
}

export const SearchMetadataSchema = buildSchema<SearchMetadataForm, "File">({
  singleSort: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Single Sort",
  }),
  recordType: makeScalarField({
    type: FieldType.String,
    displayName: "Record Type",
  }),
  firstIndex: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "First Index",
  }),
  numberOfEntries: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Number Of Entries",
  }),
  total: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Total",
  }),
});

export const defaultSearchMetadataForm: SearchMetadataForm =
  defaultValueForFields(SearchMetadataSchema);

export function toSearchMetadataForm(v: SearchMetadata): SearchMetadataForm {
  return applyDefaultValues(v, SearchMetadataSchema);
}

export interface AdvancedSearchForm {
  searchOptions: SearchOptionsForm;
  searchMetadata: SearchMetadataForm;
}

export const AdvancedSearchFormSchema = buildSchema<AdvancedSearchForm, "File">(
  {
    searchOptions: makeCompoundField({
      children: SearchOptionsSchema,
      schemaRef: "SearchOptions",
      notNullable: true,
      displayName: "Search Options",
    }),
    searchMetadata: makeCompoundField({
      children: SearchMetadataSchema,
      schemaRef: "SearchMetadata",
      notNullable: true,
      displayName: "Search Metadata",
    }),
  },
);

export const defaultAdvancedSearchForm: AdvancedSearchForm =
  defaultValueForFields(AdvancedSearchFormSchema);

export interface STPJourneyDetailsForm {
  journeyId: string | null;
  startDate: string | null;
  endDate: string | null;
  journeyNumber: number | null;
  originJourneyAddress: AddressDetailsEditForm;
  destinationJourneyAddress: AddressDetailsEditForm;
}

export const STPJourneyDetailsSchema = buildSchema<
  STPJourneyDetailsForm,
  "File"
>({
  journeyId: makeScalarField({
    type: FieldType.String,
    displayName: "Journey Id",
  }),
  startDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Start Date",
  }),
  endDate: makeScalarField({
    type: FieldType.Date,
    displayName: "End Date",
  }),
  journeyNumber: makeScalarField({
    type: FieldType.Int,
    displayName: "Journey Number",
  }),
  originJourneyAddress: makeCompoundField({
    children: AddressDetailsEditSchema,
    schemaRef: "AddressDetailsEdit",
    notNullable: true,
    displayName: "Origin Journey Address",
  }),
  destinationJourneyAddress: makeCompoundField({
    children: AddressDetailsEditSchema,
    schemaRef: "AddressDetailsEdit",
    notNullable: true,
    displayName: "Destination Journey Address",
  }),
});

export const defaultSTPJourneyDetailsForm: STPJourneyDetailsForm =
  defaultValueForFields(STPJourneyDetailsSchema);

export function toSTPJourneyDetailsForm(
  v: STPJourneyDetails,
): STPJourneyDetailsForm {
  return applyDefaultValues(v, STPJourneyDetailsSchema);
}

export interface STPVehicleInformationForm {
  registeredInTas: boolean;
  vehicleType: STPVehicleType | null;
  vehicleLookupType: MRSVehicleLookupType | null;
  plateNumber: string | null;
  vinOrChassisNumber: string | null;
  make: string | null;
  model: string | null;
  colour: string | null;
  bodyType: string | null;
  makeId: string | null;
  bodyTypeId: string | null;
  colourId: string | null;
  enginSize: string | null;
  registrationId: string | null;
  unladenMass: STPUnladenMass | null;
  detailsCorrect: boolean | null;
}

export const STPVehicleInformationSchema = buildSchema<
  STPVehicleInformationForm,
  "File"
>({
  registeredInTas: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Registered In Tas",
  }),
  vehicleType: makeScalarField({
    type: FieldType.String,
    displayName: "Vehicle Type",
    options: [
      {
        name: "Motor Vehicle",
        value: "MotorVehicle",
      },
      {
        name: "Trailer",
        value: "Trailer",
      },
    ],
  }),
  vehicleLookupType: makeScalarField({
    type: FieldType.Int,
    displayName: "Vehicle Lookup Type",
    options: [
      {
        name: "Plate Number",
        value: 0,
      },
      {
        name: "VIN",
        value: 1,
      },
      {
        name: "Chassis Number",
        value: 2,
      },
    ],
  }),
  plateNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Plate Number",
  }),
  vinOrChassisNumber: makeScalarField({
    type: FieldType.String,
    displayName: "VIN Or Chassis Number",
  }),
  make: makeScalarField({
    type: FieldType.String,
    displayName: "Make",
  }),
  model: makeScalarField({
    type: FieldType.String,
    displayName: "Model",
  }),
  colour: makeScalarField({
    type: FieldType.String,
    displayName: "Colour",
  }),
  bodyType: makeScalarField({
    type: FieldType.String,
    displayName: "Body Type",
  }),
  makeId: makeScalarField({
    type: FieldType.String,
    displayName: "Make Id",
  }),
  bodyTypeId: makeScalarField({
    type: FieldType.String,
    displayName: "Body Type Id",
  }),
  colourId: makeScalarField({
    type: FieldType.String,
    displayName: "Colour Id",
  }),
  enginSize: makeScalarField({
    type: FieldType.String,
    displayName: "Engin Size",
  }),
  registrationId: makeScalarField({
    type: FieldType.String,
    displayName: "Registration Id",
  }),
  unladenMass: makeScalarField({
    type: FieldType.String,
    displayName: "Unladen Mass",
    options: [
      {
        name: "LessThanOrEqualTo500",
        value: "LessThanOrEqualTo500",
      },
      {
        name: "Over500",
        value: "Over500",
      },
    ],
  }),
  detailsCorrect: makeScalarField({
    type: FieldType.Bool,
    displayName: "Details Correct",
  }),
});

export const defaultSTPVehicleInformationForm: STPVehicleInformationForm =
  defaultValueForFields(STPVehicleInformationSchema);

export function toSTPVehicleInformationForm(
  v: STPVehicleInformation,
): STPVehicleInformationForm {
  return applyDefaultValues(v, STPVehicleInformationSchema);
}

export interface STPQuoteLineItemForm {
  sequenceNumber: number | null;
  feeCode: string;
  description: string;
  amount: number | null;
}

export const STPQuoteLineItemSchema = buildSchema<STPQuoteLineItemForm, "File">(
  {
    sequenceNumber: makeScalarField({
      type: FieldType.Int,
      displayName: "Sequence Number",
    }),
    feeCode: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Fee Code",
    }),
    description: makeScalarField({
      type: FieldType.String,
      notNullable: true,
      required: true,
      displayName: "Description",
    }),
    amount: makeScalarField({
      type: FieldType.Double,
      displayName: "Amount",
    }),
  },
);

export const defaultSTPQuoteLineItemForm: STPQuoteLineItemForm =
  defaultValueForFields(STPQuoteLineItemSchema);

export function toSTPQuoteLineItemForm(
  v: STPQuoteLineItem,
): STPQuoteLineItemForm {
  return applyDefaultValues(v, STPQuoteLineItemSchema);
}

export interface STPQuoteForm {
  correlationId: string;
  receiptNumber: string | null;
  permitFee: number | null;
  permitLineItems: STPQuoteLineItemForm[];
}

export const STPQuoteSchema = buildSchema<STPQuoteForm, "File">({
  correlationId: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Correlation Id",
  }),
  receiptNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Receipt Number",
  }),
  permitFee: makeScalarField({
    type: FieldType.Double,
    displayName: "Permit Fee",
  }),
  permitLineItems: makeCompoundField({
    children: STPQuoteLineItemSchema,
    schemaRef: "STPQuoteLineItem",
    collection: true,
    notNullable: true,
    displayName: "Permit Line Items",
  }),
});

export const defaultSTPQuoteForm: STPQuoteForm =
  defaultValueForFields(STPQuoteSchema);

export function toSTPQuoteForm(v: STPQuote): STPQuoteForm {
  return applyDefaultValues(v, STPQuoteSchema);
}

export interface VehicleDetailsOptionsForm {
  value: string;
  name: string;
}

export const VehicleDetailsOptionsSchema = buildSchema<
  VehicleDetailsOptionsForm,
  "File"
>({
  value: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Value",
  }),
  name: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Name",
  }),
});

export const defaultVehicleDetailsOptionsForm: VehicleDetailsOptionsForm =
  defaultValueForFields(VehicleDetailsOptionsSchema);

export function toVehicleDetailsOptionsForm(
  v: VehicleDetailsOptions,
): VehicleDetailsOptionsForm {
  return applyDefaultValues(v, VehicleDetailsOptionsSchema);
}

export interface STPVehicleDetailOptionForm {
  makes: VehicleDetailsOptionsForm[];
  bodyTypes: VehicleDetailsOptionsForm[];
  colours: VehicleDetailsOptionsForm[];
}

export const STPVehicleDetailOptionSchema = buildSchema<
  STPVehicleDetailOptionForm,
  "File"
>({
  makes: makeCompoundField({
    children: VehicleDetailsOptionsSchema,
    schemaRef: "VehicleDetailsOptions",
    collection: true,
    notNullable: true,
    displayName: "Makes",
  }),
  bodyTypes: makeCompoundField({
    children: VehicleDetailsOptionsSchema,
    schemaRef: "VehicleDetailsOptions",
    collection: true,
    notNullable: true,
    displayName: "Body Types",
  }),
  colours: makeCompoundField({
    children: VehicleDetailsOptionsSchema,
    schemaRef: "VehicleDetailsOptions",
    collection: true,
    notNullable: true,
    displayName: "Colours",
  }),
});

export const defaultSTPVehicleDetailOptionForm: STPVehicleDetailOptionForm =
  defaultValueForFields(STPVehicleDetailOptionSchema);

export function toSTPVehicleDetailOptionForm(
  v: STPVehicleDetailOption,
): STPVehicleDetailOptionForm {
  return applyDefaultValues(v, STPVehicleDetailOptionSchema);
}

export interface STPForm {
  roadworthy: boolean;
  notWrittenOff: boolean;
  certifiedModification: boolean;
  currentRegistered: boolean;
  complyWithConditionsOfUVP: boolean;
  purpose: STPJourneyType | null;
  eventName: string | null;
  eventDate: string | null;
  editableItemIndex: number | null;
  editingItem: boolean;
  addingItem: boolean;
  searched: boolean | null;
  addingCustomOriginAddress: boolean | null;
  addingCustomDestinationAddress: boolean | null;
  journeyDetails: STPJourneyDetailsForm[];
  journeyDetailsEdit: STPJourneyDetailsForm | null;
  vehicleInformation: STPVehicleInformationForm;
  vehicleDetailCorrect: boolean;
  availability: PaymentAvailabilityForm | null;
  paymentMethod: PaymentMethod | null;
  stpQuote: STPQuoteForm | null;
  singleUseToken: string;
  vehicleDetailOptions: STPVehicleDetailOptionForm | null;
}

export const STPFormSchema = buildSchema<STPForm, "File">({
  roadworthy: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Roadworthy",
  }),
  notWrittenOff: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Not Written Off",
  }),
  certifiedModification: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Certified Modification",
  }),
  currentRegistered: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Current Registered",
  }),
  complyWithConditionsOfUVP: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Comply With Conditions OfUVP",
  }),
  purpose: makeScalarField({
    type: FieldType.String,
    displayName: "Purpose",
    options: [
      {
        name: "Relocation",
        value: "Relocation",
      },
      {
        name: "Repairs",
        value: "Repairs",
      },
      {
        name: "Event",
        value: "Event",
      },
    ],
  }),
  eventName: makeScalarField({
    type: FieldType.String,
    displayName: "Event Name",
  }),
  eventDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Event Date",
  }),
  editableItemIndex: makeScalarField({
    type: FieldType.Int,
    displayName: "editable Item Index",
  }),
  editingItem: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "editing Item",
  }),
  addingItem: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "adding Item",
  }),
  searched: makeScalarField({
    type: FieldType.Bool,
    displayName: "searched",
  }),
  addingCustomOriginAddress: makeScalarField({
    type: FieldType.Bool,
    displayName: "adding Custom Origin Address",
  }),
  addingCustomDestinationAddress: makeScalarField({
    type: FieldType.Bool,
    displayName: "adding Custom Destination Address",
  }),
  journeyDetails: makeCompoundField({
    children: STPJourneyDetailsSchema,
    schemaRef: "STPJourneyDetails",
    collection: true,
    notNullable: true,
    displayName: "Journey Details",
  }),
  journeyDetailsEdit: makeCompoundField({
    children: STPJourneyDetailsSchema,
    schemaRef: "STPJourneyDetails",
    displayName: "Journey Details Edit",
  }),
  vehicleInformation: makeCompoundField({
    children: STPVehicleInformationSchema,
    schemaRef: "STPVehicleInformation",
    notNullable: true,
    displayName: "Vehicle Information",
  }),
  vehicleDetailCorrect: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Vehicle Detail Correct",
  }),
  availability: makeCompoundField({
    children: PaymentAvailabilitySchema,
    schemaRef: "PaymentAvailability",
    displayName: "Availability",
  }),
  paymentMethod: makeScalarField({
    type: FieldType.Int,
    displayName: "Payment Method",
    options: [
      {
        name: "Google Pay",
        value: 0,
      },
      {
        name: "Apple Pay",
        value: 1,
      },
      {
        name: "Credit or debit card (Visa and MasterCard only)",
        value: 2,
      },
      {
        name: "BPAY",
        value: 3,
      },
      {
        name: "PayTo",
        value: 4,
      },
    ],
  }),
  stpQuote: makeCompoundField({
    children: STPQuoteSchema,
    schemaRef: "STPQuote",
    displayName: "STP Quote",
  }),
  singleUseToken: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Single Use Token",
  }),
  vehicleDetailOptions: makeCompoundField({
    children: STPVehicleDetailOptionSchema,
    schemaRef: "STPVehicleDetailOption",
    displayName: "Vehicle Detail Options",
  }),
});

export const defaultSTPForm: STPForm = defaultValueForFields(STPFormSchema);

export interface AboutForm {}

export const AboutSchema = buildSchema<AboutForm, "File">({});

export const defaultAboutForm: AboutForm = defaultValueForFields(AboutSchema);

export interface MrsLicenceSummaryForm {
  licence: MrsLicenceSummaryAppForm;
}

export const MrsLicenceSummaryFormSchema = buildSchema<
  MrsLicenceSummaryForm,
  "File"
>({
  licence: makeCompoundField({
    children: MrsLicenceSummarySchema,
    schemaRef: "MrsLicenceSummary",
    notNullable: true,
    displayName: "Licence",
  }),
});

export const defaultMrsLicenceSummaryForm: MrsLicenceSummaryForm =
  defaultValueForFields(MrsLicenceSummaryFormSchema);

export interface MrsRegistrationsSummaryForm {
  registrations: MrsRegistrationSummaryForm[];
}

export const MrsRegistrationsSummaryFormSchema = buildSchema<
  MrsRegistrationsSummaryForm,
  "File"
>({
  registrations: makeCompoundField({
    children: MrsRegistrationSummarySchema,
    schemaRef: "MrsRegistrationSummary",
    collection: true,
    notNullable: true,
    displayName: "Registrations",
  }),
});

export const defaultMrsRegistrationsSummaryForm: MrsRegistrationsSummaryForm =
  defaultValueForFields(MrsRegistrationsSummaryFormSchema);

export interface MrsDemeritsSummaryForm {
  demerits: MrsDemeritsSummaryAppForm;
}

export const MrsDemeritsSummaryFormSchema = buildSchema<
  MrsDemeritsSummaryForm,
  "File"
>({
  demerits: makeCompoundField({
    children: MrsDemeritsSummarySchema,
    schemaRef: "MrsDemeritsSummary",
    notNullable: true,
    displayName: "Demerits",
  }),
});

export const defaultMrsDemeritsSummaryForm: MrsDemeritsSummaryForm =
  defaultValueForFields(MrsDemeritsSummaryFormSchema);

export interface PushNotificationsOnboardingForm {}

export const PushNotificationsOnboardingFormSchema = buildSchema<
  PushNotificationsOnboardingForm,
  "File"
>({});

export const defaultPushNotificationsOnboardingForm: PushNotificationsOnboardingForm =
  defaultValueForFields(PushNotificationsOnboardingFormSchema);

export interface BiometricOnboardingForm {}

export const BiometricOnboardingFormSchema = buildSchema<
  BiometricOnboardingForm,
  "File"
>({});

export const defaultBiometricOnboardingForm: BiometricOnboardingForm =
  defaultValueForFields(BiometricOnboardingFormSchema);

export interface ContactUsForm {}

export const ContactUsSchema = buildSchema<ContactUsForm, "File">({});

export const defaultContactUsForm: ContactUsForm =
  defaultValueForFields(ContactUsSchema);

export interface ContactUsEnquiryForm {
  firstName: string;
  lastName: string;
  emailAddress: string;
  contactNumber: string;
  description: string;
  communicationMethod: CommunicationMethod | null;
}

export const ContactUsEnquiryFormSchema = buildSchema<
  ContactUsEnquiryForm,
  "File"
>({
  firstName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "First Name",
  }),
  lastName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Last Name",
  }),
  emailAddress: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Email Address",
  }),
  contactNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Contact Number",
  }),
  description: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Description",
  }),
  communicationMethod: makeScalarField({
    type: FieldType.String,
    displayName: "Communication Method",
    options: [
      {
        name: "Phone",
        value: "Phone",
      },
      {
        name: "Email",
        value: "Email",
      },
    ],
  }),
});

export const defaultContactUsEnquiryForm: ContactUsEnquiryForm =
  defaultValueForFields(ContactUsEnquiryFormSchema);

export interface FormAddressDetailForm {
  addressType: FormAddressType;
  address: string;
}

export const FormAddressDetailSchema = buildSchema<
  FormAddressDetailForm,
  "File"
>({
  addressType: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Address Type",
    options: [
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Portal",
        value: "Portal",
      },
    ],
  }),
  address: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Address",
  }),
});

export const defaultFormAddressDetailForm: FormAddressDetailForm =
  defaultValueForFields(FormAddressDetailSchema);

export function toFormAddressDetailForm(
  v: FormAddressDetail,
): FormAddressDetailForm {
  return applyDefaultValues(v, FormAddressDetailSchema);
}

export interface FormAddressSummaryForm {
  isDifferent: boolean;
  displayAddress: string | null;
  addresses: FormAddressDetailForm[] | null;
  selectedAddressType: FormAddressType | null;
}

export const FormAddressSummarySchema = buildSchema<
  FormAddressSummaryForm,
  "File"
>({
  isDifferent: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Different",
  }),
  displayAddress: makeScalarField({
    type: FieldType.String,
    displayName: "Display Address",
  }),
  addresses: makeCompoundField({
    children: FormAddressDetailSchema,
    schemaRef: "FormAddressDetail",
    collection: true,
    displayName: "Addresses",
  }),
  selectedAddressType: makeScalarField({
    type: FieldType.String,
    displayName: "Selected Address Type",
    options: [
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Portal",
        value: "Portal",
      },
    ],
  }),
});

export const defaultFormAddressSummaryForm: FormAddressSummaryForm =
  defaultValueForFields(FormAddressSummarySchema);

export function toFormAddressSummaryForm(
  v: FormAddressSummary,
): FormAddressSummaryForm {
  return applyDefaultValues(v, FormAddressSummarySchema);
}

export interface FormAddressForm {
  residentialAddress: FormAddressSummaryForm;
  postalAddress: FormAddressSummaryForm;
}

export const FormAddressSchema = buildSchema<FormAddressForm, "File">({
  residentialAddress: makeCompoundField({
    children: FormAddressSummarySchema,
    schemaRef: "FormAddressSummary",
    notNullable: true,
    displayName: "Residential Address",
  }),
  postalAddress: makeCompoundField({
    children: FormAddressSummarySchema,
    schemaRef: "FormAddressSummary",
    notNullable: true,
    displayName: "Postal Address",
  }),
});

export const defaultFormAddressForm: FormAddressForm =
  defaultValueForFields(FormAddressSchema);

export function toFormAddressForm(v: FormAddress): FormAddressForm {
  return applyDefaultValues(v, FormAddressSchema);
}

export interface PaymentOptionForm {
  isDefault: boolean | null;
  termValue: number;
  term: string;
  newExpiry: string | null;
  unavailableReason: string;
  cost: number | null;
  costLineItems: LineItemForm[];
  concessionApplied: boolean | null;
  concessionDescription: string;
  bPayBillerCode: string;
  bPayReference: string;
  bPayViewCode: string;
}

export const PaymentOptionSchema = buildSchema<PaymentOptionForm, "File">({
  isDefault: makeScalarField({
    type: FieldType.Bool,
    displayName: "Is Default",
  }),
  termValue: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Term Value",
  }),
  term: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Term",
  }),
  newExpiry: makeScalarField({
    type: FieldType.DateTime,
    displayName: "New Expiry",
  }),
  unavailableReason: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Unavailable Reason",
  }),
  cost: makeScalarField({
    type: FieldType.Double,
    displayName: "Cost",
  }),
  costLineItems: makeCompoundField({
    children: LineItemSchema,
    schemaRef: "LineItem",
    collection: true,
    notNullable: true,
    displayName: "Cost Line Items",
  }),
  concessionApplied: makeScalarField({
    type: FieldType.Bool,
    displayName: "Concession Applied",
  }),
  concessionDescription: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Concession Description",
  }),
  bPayBillerCode: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "B Pay Biller Code",
  }),
  bPayReference: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "B Pay Reference",
  }),
  bPayViewCode: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "B Pay View Code",
  }),
});

export const defaultPaymentOptionForm: PaymentOptionForm =
  defaultValueForFields(PaymentOptionSchema);

export function toPaymentOptionForm(v: PaymentOption): PaymentOptionForm {
  return applyDefaultValues(v, PaymentOptionSchema);
}

export interface MrsLicenceRenewalForm {
  formAddress: FormAddressForm;
  paymentOptions: PaymentOptionForm[];
  selectedOption: number;
  paymentOption: PaymentOptionForm | null;
  paymentMethod: PaymentMethod;
  availability: PaymentAvailabilityForm;
}

export const MrsLicenceRenewalFormSchema = buildSchema<
  MrsLicenceRenewalForm,
  "File"
>({
  formAddress: makeCompoundField({
    children: FormAddressSchema,
    schemaRef: "FormAddress",
    notNullable: true,
    displayName: "Form Address",
  }),
  paymentOptions: makeCompoundField({
    children: PaymentOptionSchema,
    schemaRef: "PaymentOption",
    collection: true,
    notNullable: true,
    displayName: "Payment Options",
  }),
  selectedOption: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Selected Option",
  }),
  paymentOption: makeCompoundField({
    children: PaymentOptionSchema,
    schemaRef: "PaymentOption",
    displayName: "Payment Option",
  }),
  paymentMethod: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Payment Method",
    options: [
      {
        name: "Google Pay",
        value: 0,
      },
      {
        name: "Apple Pay",
        value: 1,
      },
      {
        name: "Credit or debit card (Visa and MasterCard only)",
        value: 2,
      },
      {
        name: "BPAY",
        value: 3,
      },
      {
        name: "PayTo",
        value: 4,
      },
    ],
  }),
  availability: makeCompoundField({
    children: PaymentAvailabilitySchema,
    schemaRef: "PaymentAvailability",
    notNullable: true,
    displayName: "Availability",
  }),
});

export const defaultMrsLicenceRenewalForm: MrsLicenceRenewalForm =
  defaultValueForFields(MrsLicenceRenewalFormSchema);

export interface MrsRegistrationRenewalForm {
  paymentOptions: PaymentOptionForm[];
  selectedOption: number;
  paymentOption: PaymentOptionForm | null;
  paymentMethod: PaymentMethod;
  availability: PaymentAvailabilityForm;
}

export const MrsRegistrationRenewalFormSchema = buildSchema<
  MrsRegistrationRenewalForm,
  "File"
>({
  paymentOptions: makeCompoundField({
    children: PaymentOptionSchema,
    schemaRef: "PaymentOption",
    collection: true,
    notNullable: true,
    displayName: "Payment Options",
  }),
  selectedOption: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Selected Option",
  }),
  paymentOption: makeCompoundField({
    children: PaymentOptionSchema,
    schemaRef: "PaymentOption",
    displayName: "Payment Option",
  }),
  paymentMethod: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Payment Method",
    options: [
      {
        name: "Google Pay",
        value: 0,
      },
      {
        name: "Apple Pay",
        value: 1,
      },
      {
        name: "Credit or debit card (Visa and MasterCard only)",
        value: 2,
      },
      {
        name: "BPAY",
        value: 3,
      },
      {
        name: "PayTo",
        value: 4,
      },
    ],
  }),
  availability: makeCompoundField({
    children: PaymentAvailabilitySchema,
    schemaRef: "PaymentAvailability",
    notNullable: true,
    displayName: "Availability",
  }),
});

export const defaultMrsRegistrationRenewalForm: MrsRegistrationRenewalForm =
  defaultValueForFields(MrsRegistrationRenewalFormSchema);

export interface MrsAllRegistrationsForm {
  registrations: MrsRegistrationSummaryForm[];
}

export const MrsAllRegistrationsFormSchema = buildSchema<
  MrsAllRegistrationsForm,
  "File"
>({
  registrations: makeCompoundField({
    children: MrsRegistrationSummarySchema,
    schemaRef: "MrsRegistrationSummary",
    collection: true,
    notNullable: true,
    displayName: "Registrations",
  }),
});

export const defaultMrsAllRegistrationsForm: MrsAllRegistrationsForm =
  defaultValueForFields(MrsAllRegistrationsFormSchema);

export interface ClientLinkLicenceForm {
  licenceNumber: string;
  cardNumber: string;
}

export const ClientLinkLicenceSchema = buildSchema<
  ClientLinkLicenceForm,
  "File"
>({
  licenceNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Licence Number",
  }),
  cardNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Card Number",
  }),
});

export const defaultClientLinkLicenceForm: ClientLinkLicenceForm =
  defaultValueForFields(ClientLinkLicenceSchema);

export function toClientLinkLicenceForm(
  v: ClientLinkLicence,
): ClientLinkLicenceForm {
  return applyDefaultValues(v, ClientLinkLicenceSchema);
}

export interface ClientLinkRegistrationForm {
  registrationNumber: string;
  vin: string;
}

export const ClientLinkRegistrationSchema = buildSchema<
  ClientLinkRegistrationForm,
  "File"
>({
  registrationNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Registration Number",
  }),
  vin: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "VIN",
  }),
});

export const defaultClientLinkRegistrationForm: ClientLinkRegistrationForm =
  defaultValueForFields(ClientLinkRegistrationSchema);

export function toClientLinkRegistrationForm(
  v: ClientLinkRegistration,
): ClientLinkRegistrationForm {
  return applyDefaultValues(v, ClientLinkRegistrationSchema);
}

export interface LinkMrsWizardForm {
  agreeToTermsAndConditions: boolean;
  fullName: string | null;
  dateOfBirth: string | null;
  detailsMatch: boolean | null;
  type: MRSLinkType | null;
  linkLicence: ClientLinkLicenceForm | null;
  linkRegistration: ClientLinkRegistrationForm | null;
  formAddress: FormAddressForm;
  needACallback: boolean | null;
  sameContactNumber: boolean | null;
  contactNumber: string | null;
  alternativeNumber: string | null;
}

export const LinkMrsWizardSchema = buildSchema<LinkMrsWizardForm, "File">({
  agreeToTermsAndConditions: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Agree To Terms And Conditions",
  }),
  fullName: makeScalarField({
    type: FieldType.String,
    displayName: "Full Name",
  }),
  dateOfBirth: makeScalarField({
    type: FieldType.String,
    displayName: "Date Of Birth",
  }),
  detailsMatch: makeScalarField({
    type: FieldType.Bool,
    displayName: "Details Match",
  }),
  type: makeScalarField({
    type: FieldType.String,
    displayName: "Type",
    options: [
      {
        name: "Tasmanian driver licence",
        value: "Licence",
      },
      {
        name: "Vehicle registration details",
        value: "Registration",
      },
    ],
  }),
  linkLicence: makeCompoundField({
    children: ClientLinkLicenceSchema,
    schemaRef: "ClientLinkLicence",
    displayName: "Link Licence",
  }),
  linkRegistration: makeCompoundField({
    children: ClientLinkRegistrationSchema,
    schemaRef: "ClientLinkRegistration",
    displayName: "Link Registration",
  }),
  formAddress: makeCompoundField({
    children: FormAddressSchema,
    schemaRef: "FormAddress",
    notNullable: true,
    displayName: "Form Address",
  }),
  needACallback: makeScalarField({
    type: FieldType.Bool,
    displayName: "NeedA Callback",
  }),
  sameContactNumber: makeScalarField({
    type: FieldType.Bool,
    displayName: "Same Contact Number",
  }),
  contactNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Contact Number",
  }),
  alternativeNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Alternative Number",
  }),
});

export const defaultLinkMrsWizardForm: LinkMrsWizardForm =
  defaultValueForFields(LinkMrsWizardSchema);

export interface BirthCertificateValidationForm {
  registrationState: StateType;
  certificateNumber: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  type: DocumentValidationType;
}

export const BirthCertificateValidationSchema = buildSchema<
  BirthCertificateValidationForm,
  "File"
>({
  registrationState: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Registration State",
    options: [
      {
        name: "TAS",
        value: "TAS",
      },
      {
        name: "NSW",
        value: "NSW",
      },
      {
        name: "VIC",
        value: "VIC",
      },
      {
        name: "ACT",
        value: "ACT",
      },
      {
        name: "NT",
        value: "NT",
      },
      {
        name: "WA",
        value: "WA",
      },
      {
        name: "SA",
        value: "SA",
      },
      {
        name: "QLD",
        value: "QLD",
      },
    ],
  }),
  certificateNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Certificate Number",
  }),
  registrationNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Registration Number",
  }),
  registrationDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Registration Date",
  }),
  type: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
});

export const defaultBirthCertificateValidationForm: BirthCertificateValidationForm =
  defaultValueForFields(BirthCertificateValidationSchema);

export function toBirthCertificateValidationForm(
  v: BirthCertificateValidation,
): BirthCertificateValidationForm {
  return applyDefaultValues(v, BirthCertificateValidationSchema);
}

export interface AustralianPassportValidationForm {
  travelDocumentNumber: string;
  type: DocumentValidationType;
}

export const AustralianPassportValidationSchema = buildSchema<
  AustralianPassportValidationForm,
  "File"
>({
  travelDocumentNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Travel Document Number",
  }),
  type: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
});

export const defaultAustralianPassportValidationForm: AustralianPassportValidationForm =
  defaultValueForFields(AustralianPassportValidationSchema);

export function toAustralianPassportValidationForm(
  v: AustralianPassportValidation,
): AustralianPassportValidationForm {
  return applyDefaultValues(v, AustralianPassportValidationSchema);
}

export interface VisaValidationForm {
  passportNumber: string;
  type: DocumentValidationType;
}

export const VisaValidationSchema = buildSchema<VisaValidationForm, "File">({
  passportNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Passport Number",
  }),
  type: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
});

export const defaultVisaValidationForm: VisaValidationForm =
  defaultValueForFields(VisaValidationSchema);

export function toVisaValidationForm(v: VisaValidation): VisaValidationForm {
  return applyDefaultValues(v, VisaValidationSchema);
}

export interface ImmiCardValidationForm {
  immiCardNumber: string;
  type: DocumentValidationType;
}

export const ImmiCardValidationSchema = buildSchema<
  ImmiCardValidationForm,
  "File"
>({
  immiCardNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Immi Card Number",
  }),
  type: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
});

export const defaultImmiCardValidationForm: ImmiCardValidationForm =
  defaultValueForFields(ImmiCardValidationSchema);

export function toImmiCardValidationForm(
  v: ImmiCardValidation,
): ImmiCardValidationForm {
  return applyDefaultValues(v, ImmiCardValidationSchema);
}

export interface PlatesPlusRegistrationWizardForm {
  validationType: DocumentValidationType | null;
  startingConfirmation: boolean | null;
  agreeToTermsAndConditions: boolean | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  clientId: string | null;
  birthCertificateValidation: BirthCertificateValidationForm | null;
  australianPassportValidation: AustralianPassportValidationForm | null;
  visaValidation: VisaValidationForm | null;
  immiCardValidation: ImmiCardValidationForm | null;
  addressEdit: AddressEditForm | null;
  needACallback: boolean | null;
  sameContactNumber: boolean | null;
  contactNumber: string | null;
  alternativeNumber: string | null;
}

export const PlatesPlusRegistrationWizardSchema = buildSchema<
  PlatesPlusRegistrationWizardForm,
  "File"
>({
  validationType: makeScalarField({
    type: FieldType.String,
    displayName: "Validation Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
  startingConfirmation: makeScalarField({
    type: FieldType.Bool,
    displayName: "Starting Confirmation",
  }),
  agreeToTermsAndConditions: makeScalarField({
    type: FieldType.Bool,
    displayName: "Agree To Terms And Conditions",
  }),
  firstName: makeScalarField({
    type: FieldType.String,
    displayName: "First Name",
  }),
  lastName: makeScalarField({
    type: FieldType.String,
    displayName: "Last Name",
  }),
  dateOfBirth: makeScalarField({
    type: FieldType.Date,
    displayName: "Date Of Birth",
  }),
  clientId: makeScalarField({
    type: FieldType.String,
    displayName: "Client Id",
  }),
  birthCertificateValidation: makeCompoundField({
    children: BirthCertificateValidationSchema,
    schemaRef: "BirthCertificateValidation",
    displayName: "Birth Certificate Validation",
  }),
  australianPassportValidation: makeCompoundField({
    children: AustralianPassportValidationSchema,
    schemaRef: "AustralianPassportValidation",
    displayName: "Australian Passport Validation",
  }),
  visaValidation: makeCompoundField({
    children: VisaValidationSchema,
    schemaRef: "VisaValidation",
    displayName: "Visa Validation",
  }),
  immiCardValidation: makeCompoundField({
    children: ImmiCardValidationSchema,
    schemaRef: "ImmiCardValidation",
    displayName: "Immi Card Validation",
  }),
  addressEdit: makeCompoundField({
    children: AddressEditSchema,
    schemaRef: "AddressEdit",
    displayName: "Address Edit",
  }),
  needACallback: makeScalarField({
    type: FieldType.Bool,
    displayName: "NeedA Callback",
  }),
  sameContactNumber: makeScalarField({
    type: FieldType.Bool,
    displayName: "Same Contact Number",
  }),
  contactNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Contact Number",
  }),
  alternativeNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Alternative Number",
  }),
});

export const defaultPlatesPlusRegistrationWizardForm: PlatesPlusRegistrationWizardForm =
  defaultValueForFields(PlatesPlusRegistrationWizardSchema);

export interface MastLicenceSummaryForm {
  licence: MastLicenceSummaryAppForm;
}

export const MastLicenceSummaryFormSchema = buildSchema<
  MastLicenceSummaryForm,
  "File"
>({
  licence: makeCompoundField({
    children: MastLicenceSummarySchema,
    schemaRef: "MastLicenceSummary",
    notNullable: true,
    displayName: "Licence",
  }),
});

export const defaultMastLicenceSummaryForm: MastLicenceSummaryForm =
  defaultValueForFields(MastLicenceSummaryFormSchema);

export interface MastBoatRegistrationSummaryForm {
  registrations: MastBoatRegistrationSummaryAppForm[];
  vessels: MastCommercialVesselSummaryAppForm[];
}

export const MastBoatRegistrationSummaryFormSchema = buildSchema<
  MastBoatRegistrationSummaryForm,
  "File"
>({
  registrations: makeCompoundField({
    children: MastRegistrationSummarySchema,
    schemaRef: "MastRegistrationSummary",
    collection: true,
    notNullable: true,
    displayName: "Registrations",
  }),
  vessels: makeCompoundField({
    children: MastCommercialVesselSummarySchema,
    schemaRef: "MastCommercialVesselSummary",
    collection: true,
    notNullable: true,
    displayName: "Vessels",
  }),
});

export const defaultMastBoatRegistrationSummaryForm: MastBoatRegistrationSummaryForm =
  defaultValueForFields(MastBoatRegistrationSummaryFormSchema);

export interface MastMooringPermitSummaryForm {
  permits: MastMooringPermitSummaryAppForm[];
}

export const MastMooringPermitSummaryFormSchema = buildSchema<
  MastMooringPermitSummaryForm,
  "File"
>({
  permits: makeCompoundField({
    children: MastMooringPermitSummarySchema,
    schemaRef: "MastMooringPermitSummary",
    collection: true,
    notNullable: true,
    displayName: "Permits",
  }),
});

export const defaultMastMooringPermitSummaryForm: MastMooringPermitSummaryForm =
  defaultValueForFields(MastMooringPermitSummaryFormSchema);

export interface LinkMastWizardForm {
  agreeToTermsAndConditions: boolean | null;
  fullName: string | null;
  dateOfBirth: string | null;
  detailsMatch: boolean | null;
  mastUserId: string | null;
  motorBoatLicenceNumber: string | null;
  motorBoatRegistrationNumber: string | null;
  mooringPermitNumber: string | null;
  personalCraftRegistrationNumber: string | null;
  commercialVesselUVI: string | null;
  needACallback: boolean | null;
  sameContactNumber: boolean | null;
  contactNumber: string | null;
  alternativeNumber: string | null;
}

export const LinkMastWizardSchema = buildSchema<LinkMastWizardForm, "File">({
  agreeToTermsAndConditions: makeScalarField({
    type: FieldType.Bool,
    displayName: "Agree To Terms And Conditions",
  }),
  fullName: makeScalarField({
    type: FieldType.String,
    displayName: "Full Name",
  }),
  dateOfBirth: makeScalarField({
    type: FieldType.String,
    displayName: "Date Of Birth",
  }),
  detailsMatch: makeScalarField({
    type: FieldType.Bool,
    displayName: "Details Match",
  }),
  mastUserId: makeScalarField({
    type: FieldType.String,
    displayName: "Mast User Id",
  }),
  motorBoatLicenceNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Motor Boat Licence Number",
  }),
  motorBoatRegistrationNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Motor Boat Registration Number",
  }),
  mooringPermitNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Mooring Permit Number",
  }),
  personalCraftRegistrationNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Personal Craft Registration Number",
  }),
  commercialVesselUVI: makeScalarField({
    type: FieldType.String,
    displayName: "Commercial VesselUVI",
  }),
  needACallback: makeScalarField({
    type: FieldType.Bool,
    displayName: "NeedA Callback",
  }),
  sameContactNumber: makeScalarField({
    type: FieldType.Bool,
    displayName: "Same Contact Number",
  }),
  contactNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Contact Number",
  }),
  alternativeNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Alternative Number",
  }),
});

export const defaultLinkMastWizardForm: LinkMastWizardForm =
  defaultValueForFields(LinkMastWizardSchema);

export interface MyProfileWebForm {
  personalDetails: PersonalDetailsForm | null;
  accountDetails: AccountDetailsForm | null;
  address: AddressEditForm | null;
}

export const MyProfileWebSchema = buildSchema<MyProfileWebForm, "File">({
  personalDetails: makeCompoundField({
    children: PersonalDetailsSchema,
    schemaRef: "PersonalDetails",
    displayName: "Personal Details",
  }),
  accountDetails: makeCompoundField({
    children: AccountDetailsFormSchema,
    schemaRef: "AccountDetailsForm",
    displayName: "Account Details",
  }),
  address: makeCompoundField({
    children: AddressEditSchema,
    schemaRef: "AddressEdit",
    displayName: "Address",
  }),
});

export const defaultMyProfileWebForm: MyProfileWebForm =
  defaultValueForFields(MyProfileWebSchema);

export function toMyProfileWebForm(v: MyProfileWeb): MyProfileWebForm {
  return applyDefaultValues(v, MyProfileWebSchema);
}

export interface MyAccountWebForm {}

export const MyAccountWebFormSchema = buildSchema<MyAccountWebForm, "File">({});

export const defaultMyAccountWebForm: MyAccountWebForm = defaultValueForFields(
  MyAccountWebFormSchema,
);

export interface DeactivateAccountForm {
  verificationCode: string;
  reason: string | null;
}

export const DeactivateAccountFormSchema = buildSchema<
  DeactivateAccountForm,
  "File"
>({
  verificationCode: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Verification Code",
  }),
  reason: makeScalarField({
    type: FieldType.String,
    displayName: "Reason",
  }),
});

export const defaultDeactivateAccountForm: DeactivateAccountForm =
  defaultValueForFields(DeactivateAccountFormSchema);

export interface RWVPRenewalStatusForm {
  sessionId: string | null;
  rwvpCard: VerificationStatus;
  faceStatus: FaceVerificationStatus;
  coi: VerificationStatus;
  primary: VerificationStatus;
}

export const RWVPRenewalStatusSchema = buildSchema<
  RWVPRenewalStatusForm,
  "File"
>({
  sessionId: makeScalarField({
    type: FieldType.String,
    displayName: "Session Id",
  }),
  rwvpCard: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Rwvp Card",
    options: [
      {
        name: "Pending",
        value: "Pending",
      },
      {
        name: "Verified",
        value: "Verified",
      },
      {
        name: "Failed",
        value: "Failed",
      },
    ],
  }),
  faceStatus: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Face Status",
    options: [
      {
        name: "Could not complete liveness detection",
        value: "NotVerified",
      },
      {
        name: "The photo we captured does not match your RWVP photo. This may be due to poor lighting, angle, or significant changes in appearance",
        value: "NoMatch",
      },
      {
        name: "Verifying",
        value: "Verifying",
      },
      {
        name: "Verified",
        value: "Verified",
      },
      {
        name: "We could not confirm you are physically present. Please ensure good lighting, remove glasses, and try again.",
        value: "NoFaceDetected",
      },
    ],
  }),
  coi: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Coi",
    options: [
      {
        name: "Pending",
        value: "Pending",
      },
      {
        name: "Verified",
        value: "Verified",
      },
      {
        name: "Failed",
        value: "Failed",
      },
    ],
  }),
  primary: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Primary",
    options: [
      {
        name: "Pending",
        value: "Pending",
      },
      {
        name: "Verified",
        value: "Verified",
      },
      {
        name: "Failed",
        value: "Failed",
      },
    ],
  }),
});

export const defaultRWVPRenewalStatusForm: RWVPRenewalStatusForm =
  defaultValueForFields(RWVPRenewalStatusSchema);

export function toRWVPRenewalStatusForm(
  v: RWVPRenewalStatus,
): RWVPRenewalStatusForm {
  return applyDefaultValues(v, RWVPRenewalStatusSchema);
}

export interface RWVPCardValidationForm {
  rwvpCardExpiryDate: string | null;
  rwvpRegistrationNumber: string | null;
}

export const RWVPCardValidationSchema = buildSchema<
  RWVPCardValidationForm,
  "File"
>({
  rwvpCardExpiryDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Rwvp Card Expiry Date",
  }),
  rwvpRegistrationNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Rwvp Registration Number",
  }),
});

export const defaultRWVPCardValidationForm: RWVPCardValidationForm =
  defaultValueForFields(RWVPCardValidationSchema);

export interface CitizenshipCertificateValidationForm {
  stockNumber: string;
  acquisitionDate: string;
  type: DocumentValidationType;
}

export const CitizenshipCertificateValidationSchema = buildSchema<
  CitizenshipCertificateValidationForm,
  "File"
>({
  stockNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Stock Number",
  }),
  acquisitionDate: makeScalarField({
    type: FieldType.Date,
    notNullable: true,
    required: true,
    displayName: "Acquisition Date",
  }),
  type: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
});

export const defaultCitizenshipCertificateValidationForm: CitizenshipCertificateValidationForm =
  defaultValueForFields(CitizenshipCertificateValidationSchema);

export function toCitizenshipCertificateValidationForm(
  v: CitizenshipCertificateValidation,
): CitizenshipCertificateValidationForm {
  return applyDefaultValues(v, CitizenshipCertificateValidationSchema);
}

export interface DriversLicenceValidationForm {
  registrationState: StateType;
  licenseNumber: string;
  cardNumber: string | null;
  type: DocumentValidationType;
}

export const DriversLicenceValidationSchema = buildSchema<
  DriversLicenceValidationForm,
  "File"
>({
  registrationState: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Registration State",
    options: [
      {
        name: "TAS",
        value: "TAS",
      },
      {
        name: "NSW",
        value: "NSW",
      },
      {
        name: "VIC",
        value: "VIC",
      },
      {
        name: "ACT",
        value: "ACT",
      },
      {
        name: "NT",
        value: "NT",
      },
      {
        name: "WA",
        value: "WA",
      },
      {
        name: "SA",
        value: "SA",
      },
      {
        name: "QLD",
        value: "QLD",
      },
    ],
  }),
  licenseNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "License Number",
  }),
  cardNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Card Number",
  }),
  type: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
});

export const defaultDriversLicenceValidationForm: DriversLicenceValidationForm =
  defaultValueForFields(DriversLicenceValidationSchema);

export function toDriversLicenceValidationForm(
  v: DriversLicenceValidation,
): DriversLicenceValidationForm {
  return applyDefaultValues(v, DriversLicenceValidationSchema);
}

export interface MarriageCertificateValidationForm {
  registrationState: StateType;
  givenName: string;
  familyName: string;
  otherGivenName: string | null;
  otherFamilyName: string | null;
  isPerson1: boolean;
  certificateNumber: string | null;
  registrationDate: string | null;
  dateOfEvent: string | null;
  registrationNumber: string | null;
  type: DocumentValidationType;
}

export const MarriageCertificateValidationSchema = buildSchema<
  MarriageCertificateValidationForm,
  "File"
>({
  registrationState: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Registration State",
    options: [
      {
        name: "TAS",
        value: "TAS",
      },
      {
        name: "NSW",
        value: "NSW",
      },
      {
        name: "VIC",
        value: "VIC",
      },
      {
        name: "ACT",
        value: "ACT",
      },
      {
        name: "NT",
        value: "NT",
      },
      {
        name: "WA",
        value: "WA",
      },
      {
        name: "SA",
        value: "SA",
      },
      {
        name: "QLD",
        value: "QLD",
      },
    ],
  }),
  givenName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Given Name",
  }),
  familyName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Family Name",
  }),
  otherGivenName: makeScalarField({
    type: FieldType.String,
    displayName: "Other Given Name",
  }),
  otherFamilyName: makeScalarField({
    type: FieldType.String,
    displayName: "Other Family Name",
  }),
  isPerson1: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Is Person1",
  }),
  certificateNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Certificate Number",
  }),
  registrationDate: makeScalarField({
    type: FieldType.Date,
    displayName: "Registration Date",
  }),
  dateOfEvent: makeScalarField({
    type: FieldType.Date,
    displayName: "Date Of Event",
  }),
  registrationNumber: makeScalarField({
    type: FieldType.String,
    displayName: "Registration Number",
  }),
  type: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
});

export const defaultMarriageCertificateValidationForm: MarriageCertificateValidationForm =
  defaultValueForFields(MarriageCertificateValidationSchema);

export function toMarriageCertificateValidationForm(
  v: MarriageCertificateValidation,
): MarriageCertificateValidationForm {
  return applyDefaultValues(v, MarriageCertificateValidationSchema);
}

export interface RWVPVerificationWizardForm {
  status: RWVPRenewalStatusForm;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  detailsMatch: boolean | null;
  haveRwvpCard: boolean | null;
  havePaidViaMyRego: boolean | null;
  rwvpCardValidation: RWVPCardValidationForm;
  agreeToTermsAndConditions: boolean;
  coiDocType: DocumentValidationType | null;
  primaryDocType: DocumentValidationType | null;
  birthCertificateValidation: BirthCertificateValidationForm | null;
  australianPassportValidation: AustralianPassportValidationForm | null;
  australianCitizenshipCertificateValidation: CitizenshipCertificateValidationForm | null;
  visaValidation: VisaValidationForm | null;
  immiCardValidation: ImmiCardValidationForm | null;
  australianDriversLicenceValidation: DriversLicenceValidationForm | null;
  australianMarriageCertificateValidation: MarriageCertificateValidationForm | null;
  remainingAttempts: number;
  submitted: boolean;
  error: string | null;
}

export const RWVPVerificationWizardFormSchema = buildSchema<
  RWVPVerificationWizardForm,
  "File"
>({
  status: makeCompoundField({
    children: RWVPRenewalStatusSchema,
    schemaRef: "RWVPRenewalStatus",
    notNullable: true,
    displayName: "Status",
  }),
  fullName: makeScalarField({
    type: FieldType.String,
    displayName: "Full Name",
  }),
  firstName: makeScalarField({
    type: FieldType.String,
    displayName: "First Name",
  }),
  lastName: makeScalarField({
    type: FieldType.String,
    displayName: "Last Name",
  }),
  dateOfBirth: makeScalarField({
    type: FieldType.String,
    displayName: "Date Of Birth",
  }),
  detailsMatch: makeScalarField({
    type: FieldType.Bool,
    displayName: "Details Match",
  }),
  haveRwvpCard: makeScalarField({
    type: FieldType.Bool,
    displayName: "Have Rwvp Card",
  }),
  havePaidViaMyRego: makeScalarField({
    type: FieldType.Bool,
    displayName: "Have Paid Via My Rego",
  }),
  rwvpCardValidation: makeCompoundField({
    children: RWVPCardValidationSchema,
    schemaRef: "RWVPCardValidation",
    notNullable: true,
    displayName: "Rwvp Card Validation",
  }),
  agreeToTermsAndConditions: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Agree To Terms And Conditions",
  }),
  coiDocType: makeScalarField({
    type: FieldType.String,
    displayName: "Coi Doc Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
  primaryDocType: makeScalarField({
    type: FieldType.String,
    displayName: "Primary Doc Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
  birthCertificateValidation: makeCompoundField({
    children: BirthCertificateValidationSchema,
    schemaRef: "BirthCertificateValidation",
    displayName: "Birth Certificate Validation",
  }),
  australianPassportValidation: makeCompoundField({
    children: AustralianPassportValidationSchema,
    schemaRef: "AustralianPassportValidation",
    displayName: "Australian Passport Validation",
  }),
  australianCitizenshipCertificateValidation: makeCompoundField({
    children: CitizenshipCertificateValidationSchema,
    schemaRef: "CitizenshipCertificateValidation",
    displayName: "Australian Citizenship Certificate Validation",
  }),
  visaValidation: makeCompoundField({
    children: VisaValidationSchema,
    schemaRef: "VisaValidation",
    displayName: "Visa Validation",
  }),
  immiCardValidation: makeCompoundField({
    children: ImmiCardValidationSchema,
    schemaRef: "ImmiCardValidation",
    displayName: "Immi Card Validation",
  }),
  australianDriversLicenceValidation: makeCompoundField({
    children: DriversLicenceValidationSchema,
    schemaRef: "DriversLicenceValidation",
    displayName: "Australian Drivers Licence Validation",
  }),
  australianMarriageCertificateValidation: makeCompoundField({
    children: MarriageCertificateValidationSchema,
    schemaRef: "MarriageCertificateValidation",
    displayName: "Australian Marriage Certificate Validation",
  }),
  remainingAttempts: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Remaining Attempts",
  }),
  submitted: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Submitted",
  }),
  error: makeScalarField({
    type: FieldType.String,
    displayName: "Error",
  }),
});

export const defaultRWVPVerificationWizardForm: RWVPVerificationWizardForm =
  defaultValueForFields(RWVPVerificationWizardFormSchema);

export interface RWVPReceiptConfirmationForm {
  receipt: string;
  registrationNumber: string;
  message: string | null;
  failure: boolean;
}

export const RWVPReceiptConfirmationSchema = buildSchema<
  RWVPReceiptConfirmationForm,
  "File"
>({
  receipt: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Receipt",
  }),
  registrationNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Registration Number",
  }),
  message: makeScalarField({
    type: FieldType.String,
    displayName: "Message",
  }),
  failure: makeScalarField({
    type: FieldType.Bool,
    notNullable: true,
    required: true,
    displayName: "Failure",
  }),
});

export const defaultRWVPReceiptConfirmationForm: RWVPReceiptConfirmationForm =
  defaultValueForFields(RWVPReceiptConfirmationSchema);

export function toRWVPReceiptConfirmationForm(
  v: RWVPReceiptConfirmation,
): RWVPReceiptConfirmationForm {
  return applyDefaultValues(v, RWVPReceiptConfirmationSchema);
}

export interface RWVPRenewalSearchOptionForm {
  from: string | null;
  to: string | null;
  offset: number;
  length: number;
  query: string | null;
  sort: string[] | null;
  filters: any | null;
}

export const RWVPRenewalSearchOptionSchema = buildSchema<
  RWVPRenewalSearchOptionForm,
  "File"
>({
  from: makeScalarField({
    type: FieldType.Date,
    displayName: "From",
  }),
  to: makeScalarField({
    type: FieldType.Date,
    displayName: "To",
  }),
  offset: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Offset",
  }),
  length: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Length",
  }),
  query: makeScalarField({
    type: FieldType.String,
    displayName: "Query",
  }),
  sort: makeScalarField({
    type: FieldType.String,
    collection: true,
    displayName: "Sort",
  }),
  filters: makeScalarField({
    type: FieldType.Any,
    displayName: "Filters",
  }),
});

export const defaultRWVPRenewalSearchOptionForm: RWVPRenewalSearchOptionForm =
  defaultValueForFields(RWVPRenewalSearchOptionSchema);

export function toRWVPRenewalSearchOptionForm(
  v: RWVPRenewalSearchOption,
): RWVPRenewalSearchOptionForm {
  return applyDefaultValues(v, RWVPRenewalSearchOptionSchema);
}

export interface RWVPRenewalListingForm {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  status: RWVPRenewalApplicationStatus;
  registrationNumber: string;
  expiryDate: string;
  licenceNumber: string;
  submitAt: string | null;
}

export const RWVPRenewalListingSchema = buildSchema<
  RWVPRenewalListingForm,
  "File"
>({
  id: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  firstName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "First Name",
  }),
  lastName: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Last Name",
  }),
  dateOfBirth: makeScalarField({
    type: FieldType.Date,
    notNullable: true,
    required: true,
    displayName: "Date Of Birth",
  }),
  status: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Status",
    options: [
      {
        name: "Draft",
        value: "Draft",
      },
      {
        name: "Submitted",
        value: "Submitted",
      },
      {
        name: "Completed",
        value: "Completed",
      },
      {
        name: "Waiting for customer",
        value: "WaitingForCustomer",
      },
      {
        name: "Complete - offline",
        value: "CompleteOffline",
      },
    ],
  }),
  registrationNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Registration Number",
  }),
  expiryDate: makeScalarField({
    type: FieldType.Date,
    notNullable: true,
    required: true,
    displayName: "Expiry Date",
  }),
  licenceNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Licence Number",
  }),
  submitAt: makeScalarField({
    type: FieldType.DateTime,
    displayName: "Submit At",
  }),
});

export const defaultRWVPRenewalListingForm: RWVPRenewalListingForm =
  defaultValueForFields(RWVPRenewalListingSchema);

export function toRWVPRenewalListingForm(
  v: RWVPRenewalListing,
): RWVPRenewalListingForm {
  return applyDefaultValues(v, RWVPRenewalListingSchema);
}

export interface RWVPRenewalListingSearchResultsForm {
  total: number | null;
  entries: RWVPRenewalListingForm[];
}

export const RWVPRenewalListingSearchResultsSchema = buildSchema<
  RWVPRenewalListingSearchResultsForm,
  "File"
>({
  total: makeScalarField({
    type: FieldType.Int,
    displayName: "Total",
  }),
  entries: makeCompoundField({
    children: RWVPRenewalListingSchema,
    schemaRef: "RWVPRenewalListing",
    collection: true,
    notNullable: true,
    displayName: "Entries",
  }),
});

export const defaultRWVPRenewalListingSearchResultsForm: RWVPRenewalListingSearchResultsForm =
  defaultValueForFields(RWVPRenewalListingSearchResultsSchema);

export function toRWVPRenewalListingSearchResultsForm(
  v: RWVPRenewalListingSearchResults,
): RWVPRenewalListingSearchResultsForm {
  return applyDefaultValues(v, RWVPRenewalListingSearchResultsSchema);
}

export interface RWVPRenewalSearchForm {
  request: RWVPRenewalSearchOptionForm;
  results: RWVPRenewalListingSearchResultsForm | null;
}

export const RWVPRenewalSearchFormSchema = buildSchema<
  RWVPRenewalSearchForm,
  "File"
>({
  request: makeCompoundField({
    children: RWVPRenewalSearchOptionSchema,
    schemaRef: "RWVPRenewalSearchOption",
    notNullable: true,
    displayName: "Request",
  }),
  results: makeCompoundField({
    children: RWVPRenewalListingSearchResultsSchema,
    schemaRef: "RWVPRenewalListingSearchResults",
    displayName: "Results",
  }),
});

export const defaultRWVPRenewalSearchForm: RWVPRenewalSearchForm =
  defaultValueForFields(RWVPRenewalSearchFormSchema);

export interface RWVPCardDetailsForm {
  cardExpiryDate: string;
  registrationNumber: string;
  licenceNumber: string;
}

export const RWVPCardDetailsSchema = buildSchema<RWVPCardDetailsForm, "File">({
  cardExpiryDate: makeScalarField({
    type: FieldType.Date,
    notNullable: true,
    required: true,
    displayName: "Card Expiry Date",
  }),
  registrationNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Registration Number",
  }),
  licenceNumber: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Licence Number",
  }),
});

export const defaultRWVPCardDetailsForm: RWVPCardDetailsForm =
  defaultValueForFields(RWVPCardDetailsSchema);

export function toRWVPCardDetailsForm(v: RWVPCardDetails): RWVPCardDetailsForm {
  return applyDefaultValues(v, RWVPCardDetailsSchema);
}

export interface RWVPVerificationDocumnetForm {
  docType: DocumentValidationType;
  uniqueIdentifier: string;
}

export const RWVPVerificationDocumnetSchema = buildSchema<
  RWVPVerificationDocumnetForm,
  "File"
>({
  docType: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Doc Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
  uniqueIdentifier: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Unique Identifier",
  }),
});

export const defaultRWVPVerificationDocumnetForm: RWVPVerificationDocumnetForm =
  defaultValueForFields(RWVPVerificationDocumnetSchema);

export function toRWVPVerificationDocumnetForm(
  v: RWVPVerificationDocumnet,
): RWVPVerificationDocumnetForm {
  return applyDefaultValues(v, RWVPVerificationDocumnetSchema);
}

export interface RWVPFaceVerificationForm {
  id: string;
  status: FaceVerificationStatus;
  confidence: number | null;
}

export const RWVPFaceVerificationSchema = buildSchema<
  RWVPFaceVerificationForm,
  "File"
>({
  id: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  status: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Status",
    options: [
      {
        name: "Could not complete liveness detection",
        value: "NotVerified",
      },
      {
        name: "The photo we captured does not match your RWVP photo. This may be due to poor lighting, angle, or significant changes in appearance",
        value: "NoMatch",
      },
      {
        name: "Verifying",
        value: "Verifying",
      },
      {
        name: "Verified",
        value: "Verified",
      },
      {
        name: "We could not confirm you are physically present. Please ensure good lighting, remove glasses, and try again.",
        value: "NoFaceDetected",
      },
    ],
  }),
  confidence: makeScalarField({
    type: FieldType.Double,
    displayName: "Confidence",
  }),
});

export const defaultRWVPFaceVerificationForm: RWVPFaceVerificationForm =
  defaultValueForFields(RWVPFaceVerificationSchema);

export function toRWVPFaceVerificationForm(
  v: RWVPFaceVerification,
): RWVPFaceVerificationForm {
  return applyDefaultValues(v, RWVPFaceVerificationSchema);
}

export interface FormUploadForm {
  id: string;
  filename: string;
  length: number;
}

export const FormUploadSchema = buildSchema<FormUploadForm, "File">({
  id: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Id",
  }),
  filename: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Filename",
  }),
  length: makeScalarField({
    type: FieldType.Int,
    notNullable: true,
    required: true,
    displayName: "Length",
  }),
});

export const defaultFormUploadForm: FormUploadForm =
  defaultValueForFields(FormUploadSchema);

export function toFormUploadForm(v: FormUpload): FormUploadForm {
  return applyDefaultValues(v, FormUploadSchema);
}

export interface RWVPRenewalDetailsForm {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  rwvpCard: RWVPCardDetailsForm;
  coiDoc: RWVPVerificationDocumnetForm | null;
  primaryDoc: RWVPVerificationDocumnetForm | null;
  secondaryDoc: RWVPVerificationDocumnetForm | null;
  faceVerification: RWVPFaceVerificationForm | null;
  secondaryFileUpload: FormUploadForm | null;
  status: RWVPRenewalApplicationStatus;
  submitAt: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export const RWVPRenewalDetailsSchema = buildSchema<
  RWVPRenewalDetailsForm,
  "File"
>({
  fullName: makeScalarField({
    type: FieldType.String,
    displayName: "Full Name",
  }),
  firstName: makeScalarField({
    type: FieldType.String,
    displayName: "First Name",
  }),
  lastName: makeScalarField({
    type: FieldType.String,
    displayName: "Last Name",
  }),
  dateOfBirth: makeScalarField({
    type: FieldType.Date,
    displayName: "Date Of Birth",
  }),
  rwvpCard: makeCompoundField({
    children: RWVPCardDetailsSchema,
    schemaRef: "RWVPCardDetails",
    notNullable: true,
    displayName: "Rwvp Card",
  }),
  coiDoc: makeCompoundField({
    children: RWVPVerificationDocumnetSchema,
    schemaRef: "RWVPVerificationDocumnet",
    displayName: "Coi Doc",
  }),
  primaryDoc: makeCompoundField({
    children: RWVPVerificationDocumnetSchema,
    schemaRef: "RWVPVerificationDocumnet",
    displayName: "Primary Doc",
  }),
  secondaryDoc: makeCompoundField({
    children: RWVPVerificationDocumnetSchema,
    schemaRef: "RWVPVerificationDocumnet",
    displayName: "Secondary Doc",
  }),
  faceVerification: makeCompoundField({
    children: RWVPFaceVerificationSchema,
    schemaRef: "RWVPFaceVerification",
    displayName: "Face Verification",
  }),
  secondaryFileUpload: makeScalarField({
    type: "File",
    displayName: "Secondary File Upload",
  }),
  status: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Status",
    options: [
      {
        name: "Draft",
        value: "Draft",
      },
      {
        name: "Submitted",
        value: "Submitted",
      },
      {
        name: "Completed",
        value: "Completed",
      },
      {
        name: "Waiting for customer",
        value: "WaitingForCustomer",
      },
      {
        name: "Complete - offline",
        value: "CompleteOffline",
      },
    ],
  }),
  submitAt: makeScalarField({
    type: FieldType.DateTime,
    displayName: "Submit At",
  }),
  phone: makeScalarField({
    type: FieldType.String,
    displayName: "Phone",
  }),
  email: makeScalarField({
    type: FieldType.String,
    displayName: "Email",
  }),
  address: makeScalarField({
    type: FieldType.String,
    displayName: "Address",
  }),
});

export const defaultRWVPRenewalDetailsForm: RWVPRenewalDetailsForm =
  defaultValueForFields(RWVPRenewalDetailsSchema);

export function toRWVPRenewalDetailsForm(
  v: RWVPRenewalDetails,
): RWVPRenewalDetailsForm {
  return applyDefaultValues(v, RWVPRenewalDetailsSchema);
}

export interface RWVPInterimForm {}

export const RWVPInterimFormSchema = buildSchema<RWVPInterimForm, "File">({});

export const defaultRWVPInterimForm: RWVPInterimForm = defaultValueForFields(
  RWVPInterimFormSchema,
);

export interface DVSValidationForm {
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  docType: DocumentValidationType | null;
  verificationStatus: VerificationStatus;
  birthCertificateValidation: BirthCertificateValidationForm | null;
  australianPassportValidation: AustralianPassportValidationForm | null;
  australianCitizenshipCertificateValidation: CitizenshipCertificateValidationForm | null;
  visaValidation: VisaValidationForm | null;
  immiCardValidation: ImmiCardValidationForm | null;
  australianDriversLicenceValidation: DriversLicenceValidationForm | null;
  australianMarriageCertificateValidation: MarriageCertificateValidationForm | null;
}

export const DVSValidationFormSchema = buildSchema<DVSValidationForm, "File">({
  firstName: makeScalarField({
    type: FieldType.String,
    displayName: "First Name",
  }),
  lastName: makeScalarField({
    type: FieldType.String,
    displayName: "Last Name",
  }),
  dateOfBirth: makeScalarField({
    type: FieldType.String,
    displayName: "Date Of Birth",
  }),
  docType: makeScalarField({
    type: FieldType.String,
    displayName: "Doc Type",
    options: [
      {
        name: "Birth certificate",
        value: "BirthCertificate",
      },
      {
        name: "Marriage certificate",
        value: "MarriageCertificate",
      },
      {
        name: "NameChangeCertificate",
        value: "NameChangeCertificate",
      },
      {
        name: "Driver licence",
        value: "DriversLicence",
      },
      {
        name: "Australian passport",
        value: "AustralianPassport",
      },
      {
        name: "Medicare card",
        value: "MedicareCard",
      },
      {
        name: "International passport",
        value: "InternationalPassport",
      },
      {
        name: "Visa",
        value: "Visa",
      },
      {
        name: "Centrelink concession card",
        value: "ServicesAustraliaCard",
      },
      {
        name: "Citizenship certificate",
        value: "CitizenshipCertificate",
      },
      {
        name: "CertificateOfRegistryByDescent",
        value: "CertificateOfRegistryByDescent",
      },
      {
        name: "ImmiCard",
        value: "ImmiCard",
      },
      {
        name: "Aviation and Maritime Security Identification card",
        value: "ASIC_MSIC_Card",
      },
      {
        name: "MRS",
        value: "MRS",
      },
      {
        name: "Upload a utility bill or similar",
        value: "FileUpload",
      },
      {
        name: "Certificate of Identity",
        value: "CertificateOfIdentity",
      },
    ],
  }),
  verificationStatus: makeScalarField({
    type: FieldType.String,
    notNullable: true,
    required: true,
    displayName: "Verification Status",
    options: [
      {
        name: "Pending",
        value: "Pending",
      },
      {
        name: "Verified",
        value: "Verified",
      },
      {
        name: "Failed",
        value: "Failed",
      },
    ],
  }),
  birthCertificateValidation: makeCompoundField({
    children: BirthCertificateValidationSchema,
    schemaRef: "BirthCertificateValidation",
    displayName: "Birth Certificate Validation",
  }),
  australianPassportValidation: makeCompoundField({
    children: AustralianPassportValidationSchema,
    schemaRef: "AustralianPassportValidation",
    displayName: "Australian Passport Validation",
  }),
  australianCitizenshipCertificateValidation: makeCompoundField({
    children: CitizenshipCertificateValidationSchema,
    schemaRef: "CitizenshipCertificateValidation",
    displayName: "Australian Citizenship Certificate Validation",
  }),
  visaValidation: makeCompoundField({
    children: VisaValidationSchema,
    schemaRef: "VisaValidation",
    displayName: "Visa Validation",
  }),
  immiCardValidation: makeCompoundField({
    children: ImmiCardValidationSchema,
    schemaRef: "ImmiCardValidation",
    displayName: "Immi Card Validation",
  }),
  australianDriversLicenceValidation: makeCompoundField({
    children: DriversLicenceValidationSchema,
    schemaRef: "DriversLicenceValidation",
    displayName: "Australian Drivers Licence Validation",
  }),
  australianMarriageCertificateValidation: makeCompoundField({
    children: MarriageCertificateValidationSchema,
    schemaRef: "MarriageCertificateValidation",
    displayName: "Australian Marriage Certificate Validation",
  }),
});

export const defaultDVSValidationForm: DVSValidationForm =
  defaultValueForFields(DVSValidationFormSchema);

export const SchemaMap = {
  FireRegistration: FireRegistrationSchema,
  Announcement: AnnouncementSchema,
  SerProviderAction: SerProviderActionSchema,
  SerProvider: SerProviderSchema,
  ApplicationTask: ApplicationTaskSchema,
  MyContactDetails: MyContactDetailsSchema,
  FireRegistrationEdit: FireRegistrationEditSchema,
  FirePermitSummary: FirePermitSummarySchema,
  DateRange: DateRangeSchema,
  FireDates: FireDatesSchema,
  InitialFireRegistration: InitialFireRegistrationSchema,
  ReceiptConfirmation: ReceiptConfirmationSchema,
  SearchResultCount: SearchResultCountSchema,
  SearchFormRequest: SearchFormRequestSchema,
  SearchForm: SearchFormSchema,
  AcknowledgeService: AcknowledgeServiceSchema,
  UpgradeOption: UpgradeOptionSchema,
  TUPDetail: TUPDetailSchema,
  TUPQuote: TUPQuoteSchema,
  LineItem: LineItemSchema,
  TUPQuoteResponse: TUPQuoteResponseSchema,
  TUPConfirmationRequest: TUPConfirmationRequestSchema,
  TUPVehicleDetail: TUPVehicleDetailSchema,
  PaymentAvailability: PaymentAvailabilitySchema,
  MRSTUPVehicleLookup: MRSTUPVehicleLookupSchema,
  MRSTUPLookupResponse: MRSTUPLookupResponseSchema,
  MRSRegistrationLookup: MRSRegistrationLookupSchema,
  TUPsForm: TUPsFormSchema,
  MRSReceiptConfirmation: MRSReceiptConfirmationSchema,
  MRSReceiptFailureForm: MRSReceiptFailureFormSchema,
  MRSRegistrationSummary: MRSRegistrationSummarySchema,
  MRSTUPAcknowledgeService: MRSTUPAcknowledgeServiceSchema,
  TUPSummary: TUPSummarySchema,
  MrsRegistrationSummary: MrsRegistrationSummarySchema,
  MrsLicenceClass: MrsLicenceClassSchema,
  MrsLicenceSummary: MrsLicenceSummarySchema,
  MrsDemeritsDetail: MrsDemeritsDetailSchema,
  MrsDemeritsSummary: MrsDemeritsSummarySchema,
  MrsSummaryForm: MrsSummaryFormSchema,
  MastRenewalSummary: MastRenewalSummarySchema,
  MastLicenceSummary: MastLicenceSummarySchema,
  MastRegistrationSummary: MastRegistrationSummarySchema,
  Point: PointSchema,
  MastMooringPermitSummary: MastMooringPermitSummarySchema,
  MastCommercialVesselSummary: MastCommercialVesselSummarySchema,
  MastSummaryForm: MastSummaryFormSchema,
  MrsLicenceMedicalCheck: MrsLicenceMedicalCheckSchema,
  MrsLicenceCondition: MrsLicenceConditionSchema,
  MrsLicenceDetailsClass: MrsLicenceDetailsClassSchema,
  MrsLicenceDetailsForm: MrsLicenceDetailsFormSchema,
  MrsRegistrationStatus: MrsRegistrationStatusSchema,
  MrsRegistrationVehicleInformation: MrsRegistrationVehicleInformationSchema,
  MrsRegistrationDefect: MrsRegistrationDefectSchema,
  MrsRegistrationDetailsForm: MrsRegistrationDetailsFormSchema,
  MyAccountForm: MyAccountFormSchema,
  MyProfileForm: MyProfileFormSchema,
  AccountPreferencesForm: AccountPreferencesFormSchema,
  PersonalDetails: PersonalDetailsSchema,
  AccountDetailsForm: AccountDetailsFormSchema,
  AddressDetailsEdit: AddressDetailsEditSchema,
  AddressEdit: AddressEditSchema,
  AddressForm: AddressFormSchema,
  NotificationPreferences: NotificationPreferencesSchema,
  SecurityPreferencesForm: SecurityPreferencesFormSchema,
  TuoProviderOption: TuoProviderOptionSchema,
  TuoPreferences: TuoPreferencesSchema,
  ServiceProviderListingForm: ServiceProviderListingFormSchema,
  LinkedServicesForm: LinkedServicesFormSchema,
  HomeForm: HomeFormSchema,
  PopularService: PopularServiceSchema,
  ServicesForm: ServicesFormSchema,
  WalletForm: WalletFormSchema,
  ServiceNotAvailableForm: ServiceNotAvailableFormSchema,
  ErrorForm: ErrorFormSchema,
  TempPaymentForm: TempPaymentFormSchema,
  PortalMessageDocument: PortalMessageDocumentSchema,
  PortalMessage: PortalMessageSchema,
  PortalMessageForm: PortalMessageFormSchema,
  PortalMessageDetailsForm: PortalMessageDetailsFormSchema,
  PortalDocument: PortalDocumentSchema,
  PortalDocumentForm: PortalDocumentFormSchema,
  SearchOptions: SearchOptionsSchema,
  SearchMetadata: SearchMetadataSchema,
  AdvancedSearchForm: AdvancedSearchFormSchema,
  STPJourneyDetails: STPJourneyDetailsSchema,
  STPVehicleInformation: STPVehicleInformationSchema,
  STPQuoteLineItem: STPQuoteLineItemSchema,
  STPQuote: STPQuoteSchema,
  VehicleDetailsOptions: VehicleDetailsOptionsSchema,
  STPVehicleDetailOption: STPVehicleDetailOptionSchema,
  STPForm: STPFormSchema,
  About: AboutSchema,
  MrsLicenceSummaryForm: MrsLicenceSummaryFormSchema,
  MrsRegistrationsSummaryForm: MrsRegistrationsSummaryFormSchema,
  MrsDemeritsSummaryForm: MrsDemeritsSummaryFormSchema,
  PushNotificationsOnboardingForm: PushNotificationsOnboardingFormSchema,
  BiometricOnboardingForm: BiometricOnboardingFormSchema,
  ContactUs: ContactUsSchema,
  ContactUsEnquiryForm: ContactUsEnquiryFormSchema,
  FormAddressDetail: FormAddressDetailSchema,
  FormAddressSummary: FormAddressSummarySchema,
  FormAddress: FormAddressSchema,
  PaymentOption: PaymentOptionSchema,
  MrsLicenceRenewalForm: MrsLicenceRenewalFormSchema,
  MrsRegistrationRenewalForm: MrsRegistrationRenewalFormSchema,
  MrsAllRegistrationsForm: MrsAllRegistrationsFormSchema,
  ClientLinkLicence: ClientLinkLicenceSchema,
  ClientLinkRegistration: ClientLinkRegistrationSchema,
  LinkMrsWizard: LinkMrsWizardSchema,
  BirthCertificateValidation: BirthCertificateValidationSchema,
  AustralianPassportValidation: AustralianPassportValidationSchema,
  VisaValidation: VisaValidationSchema,
  ImmiCardValidation: ImmiCardValidationSchema,
  PlatesPlusRegistrationWizard: PlatesPlusRegistrationWizardSchema,
  MastLicenceSummaryForm: MastLicenceSummaryFormSchema,
  MastBoatRegistrationSummaryForm: MastBoatRegistrationSummaryFormSchema,
  MastMooringPermitSummaryForm: MastMooringPermitSummaryFormSchema,
  LinkMastWizard: LinkMastWizardSchema,
  MyProfileWeb: MyProfileWebSchema,
  MyAccountWebForm: MyAccountWebFormSchema,
  DeactivateAccountForm: DeactivateAccountFormSchema,
  RWVPRenewalStatus: RWVPRenewalStatusSchema,
  RWVPCardValidation: RWVPCardValidationSchema,
  CitizenshipCertificateValidation: CitizenshipCertificateValidationSchema,
  DriversLicenceValidation: DriversLicenceValidationSchema,
  MarriageCertificateValidation: MarriageCertificateValidationSchema,
  RWVPVerificationWizardForm: RWVPVerificationWizardFormSchema,
  RWVPReceiptConfirmation: RWVPReceiptConfirmationSchema,
  RWVPRenewalSearchOption: RWVPRenewalSearchOptionSchema,
  RWVPRenewalListing: RWVPRenewalListingSchema,
  RWVPRenewalListingSearchResults: RWVPRenewalListingSearchResultsSchema,
  RWVPRenewalSearchForm: RWVPRenewalSearchFormSchema,
  RWVPCardDetails: RWVPCardDetailsSchema,
  RWVPVerificationDocumnet: RWVPVerificationDocumnetSchema,
  RWVPFaceVerification: RWVPFaceVerificationSchema,
  FormUpload: FormUploadSchema,
  RWVPRenewalDetails: RWVPRenewalDetailsSchema,
  RWVPInterimForm: RWVPInterimFormSchema,
  DVSValidationForm: DVSValidationFormSchema,
};
