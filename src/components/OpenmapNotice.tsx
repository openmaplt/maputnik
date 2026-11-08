import React, { useState } from "react";
import { MdClose } from "react-icons/md";
import type { OpenmapFailure, OpenmapUiState } from "../libs/openmap";

type OpenmapNoticeProps = {
  openmap: OpenmapUiState | null
};

// Errors from talking to openmap.lt, shown over the map (fork-only). A profile
// that could not be loaded stays on screen; a failed save can be dismissed.
export const OpenmapNotice: React.FC<OpenmapNoticeProps> = ({ openmap }) => {
  const [dismissed, setDismissed] = useState<OpenmapFailure | null>(null);

  if (!openmap) {
    return null;
  }
  if (openmap.loadError) {
    return <div className="maputnik-openmap-notice" role="alert" data-wd-key="openmap:notice">
      <strong>Nepavyko užkrauti profilio stiliaus</strong>
      <p>{openmap.loadError.message}</p>
    </div>;
  }
  if (openmap.error && openmap.error !== dismissed) {
    const failure = openmap.error;
    return <div className="maputnik-openmap-notice" role="alert" data-wd-key="openmap:notice">
      <button
        type="button"
        className="maputnik-openmap-notice-close"
        aria-label="Uždaryti"
        onClick={() => setDismissed(failure)}
      >
        <MdClose />
      </button>
      <strong>Nepavyko išsaugoti</strong>
      <p>{failure.message}</p>
    </div>;
  }
  return null;
};
