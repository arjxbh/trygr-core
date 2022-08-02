interface action {
  targetId: string;
  startTime: string;
  endTime: string;
  doAction: () => void;
}

interface trigger {
  startCondition: () => boolean;
  targetId: string;
  action: action[];
}

const triggers: trigger[] = [];
export { triggers };