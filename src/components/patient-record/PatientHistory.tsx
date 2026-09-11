import { useOutletContext } from "react-router-dom";
import { VisitHistory } from "./VisitHistory";
import type { Patient } from "../../data/mockData";

export function PatientHistory() {
  const { patient } = useOutletContext<{ patient: Patient }>();
  return <VisitHistory patientId={patient.id} />;
}
