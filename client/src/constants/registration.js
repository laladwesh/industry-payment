export const MAX_ATTENDEES = 5;

export const emptyAttendee = {
  name: "",
  email: "",
  phone: "",
  organization: "",
  designation: "",
};

export const wizardSteps = [
  {
    title: "Personal Details",
    caption: "Representative contact info",
  },
  {
    title: "Company Details",
    caption: "Company and attendee count",
  },
  {
    title: "Participants",
    caption: "Add participant info",
  },
  {
    title: "Review",
    caption: "Confirm and create",
  },
  {
    title: "Payment Proof",
    caption: "Upload transfer receipt",
  },
];
