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
    title: "Participants",
    caption: "Choose attendee count",
  },
  {
    title: "Details",
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
