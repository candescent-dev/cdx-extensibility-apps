import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  CircularProgress,
} from '@mui/material';
import { BoltIcon } from '../Icons';

interface HttpClientTestCardProps {
  scenarioType: 'Positive' | 'Negative';
  onScenarioChange: (type: 'Positive' | 'Negative') => void;
  onTestClick: () => void;
  testLoading: boolean;
  /** When false, only the Positive scenario is shown (e.g. when embedded in a host). */
  showNegativeScenario?: boolean;
  /** When false, the scenario radio group is hidden and only positive API calls are made (embedded in dbk-ui-platform). */
  showScenarioSelector?: boolean;
}

/**
 * HTTP Client Test Card component
 * @component
 */
const HttpClientTestCard: React.FC<HttpClientTestCardProps> = ({
  scenarioType,
  onScenarioChange,
  onTestClick,
  testLoading,
  showNegativeScenario = true,
  showScenarioSelector = true,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target as HTMLInputElement;
    if (target.type === 'radio' && target.value) {
      e.preventDefault();
      onScenarioChange(target.value as 'Positive' | 'Negative');
    }
  };

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} color="text.primary">
            HTTP Client Test
          </Typography>
          <BoltIcon width={24} height={24} />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Test the secure HTTP client to ensure API calls work correctly.
          <br />
          <br />
            Note : The below one is sample response, All the API calls should use this HttpClient method for making the api
            requests. <br />
        </Typography>

        {showScenarioSelector && (
          <RadioGroup
            row
            value={scenarioType}
            onChange={(_, v) => onScenarioChange(v as 'Positive' | 'Negative')}
            onKeyDown={handleKeyDown}
            sx={{ gap: 2, alignItems: 'center' }}
            aria-label="Scenario type"
          >
            <FormControlLabel
              value="Positive"
              control={
                <Radio name="scenario-positive" inputProps={{ tabIndex: 0 }} />
              }
              label="Positive"
            />
            {showNegativeScenario && (
              <FormControlLabel
                value="Negative"
                control={
                  <Radio
                    name="scenario-negative"
                    inputProps={{ tabIndex: 0 }}
                  />
                }
                label="Negative"
              />
            )}
          </RadioGroup>
        )}

        <Button
          variant="contained"
          color="primary"
          onClick={onTestClick}
          disabled={testLoading}
          fullWidth
          tabIndex={0}
        >
          {testLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} color="inherit" />
              <span>Testing...</span>
            </Box>
          ) : (
            'Test API Calls'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default HttpClientTestCard;
