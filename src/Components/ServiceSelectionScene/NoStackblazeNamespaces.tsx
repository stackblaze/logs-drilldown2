import React from 'react';

import { GrotError } from 'Components/GrotError';

export const NoStackblazeNamespaces = () => {
  return (
    <GrotError>
      <p>
        No logs found for the selected time period.
        <br />
        Please adjust the time range to see available logs.
      </p>
    </GrotError>
  );
};

