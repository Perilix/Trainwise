import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { BackBar, Screen, Section } from '@/components/ui';
import { useAthleteActions } from '@/features/athlete/queries';
import { DateStepper } from '@/features/sessions/date-stepper';
import { SimpleSessionForm } from '@/features/sessions/simple-session-form';
import { emitAppEvent } from '@/lib/app-events';
import { toIsoDay } from '@/lib/format';

export default function NewPlannedSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const { createPlannedSession } = useAthleteActions();
  const [date, setDate] = useState(() => (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : toIsoDay(new Date())));

  return (
    <Screen>
      <BackBar title="Nouvelle séance" />
      <Section style={styles.tight}>
        <DateStepper date={date} onChange={setDate} />
      </Section>
      <SimpleSessionForm
        date={date}
        submitLabel="Ajouter au planning"
        onSubmit={async (payload) => {
          await createPlannedSession(payload);
          emitAppEvent('sessions:changed');
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
});
