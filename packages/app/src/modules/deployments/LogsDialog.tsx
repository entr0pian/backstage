import { useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import { EmptyState, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { PodLogs } from '@backstage/plugin-kubernetes-react';
import { useWorkloadPods } from './useWorkloadPods';

const podKey = (pod: { clusterName: string; namespace: string; name: string }) =>
  `${pod.clusterName}/${pod.namespace}/${pod.name}`;

// Live logs for one component in one environment. The developer never picks
// a cluster, namespace or selector — only, if there's more than one, which
// pod/container. Log rendering is the Kubernetes plugin's own PodLogs.
// Errors stay inside this dialog: the rest of the Deployments tab never
// depends on the Kubernetes backend (BACKSTAGE_PART8.md).
export const LogsDialog = ({
  component,
  environment,
  open,
  onClose,
  initialPodName,
}: {
  component: string;
  environment: string;
  open: boolean;
  onClose: () => void;
  // Preselect this pod (e.g. opened from a pod row in the Details drawer).
  initialPodName?: string;
}) => {
  const state = useWorkloadPods(component, environment, open);
  const [selectedPod, setSelectedPod] = useState<string>('');
  const [selectedContainer, setSelectedContainer] = useState<string>('');

  const pods = state.status === 'done' ? state.pods : [];
  const pod =
    pods.find(p => podKey(p) === selectedPod) ??
    pods.find(p => p.name === initialPodName) ??
    pods[0];
  const container =
    pod?.containers.find(c => c === selectedContainer) ?? pod?.containers[0];

  // Reset the selection whenever the dialog is reopened for fresh data.
  useEffect(() => {
    if (open) {
      setSelectedPod('');
      setSelectedContainer('');
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        Logs — {component} / {environment}
      </DialogTitle>
      <DialogContent>
        {state.status === 'loading' && <Progress />}
        {state.status === 'error' && <ResponseErrorPanel error={state.error} />}
        {state.status === 'done' && pods.length === 0 && (
          <EmptyState
            missing="data"
            title={`No running pods found for ${component} in ${environment}`}
            description="Pods are found by their platform.taskapp.io/component and platform.taskapp.io/environment labels. A service scaffolded before golang-service 0.6.0 may be missing them — see BACKSTAGE_PART8.md."
          />
        )}
        {pod && container && (
          <>
            <Box display="flex" style={{ gap: 16 }} mb={2} alignItems="flex-end">
              <FormControl style={{ minWidth: 320 }}>
                <InputLabel id="logs-pod">Pod</InputLabel>
                <Select
                  labelId="logs-pod"
                  value={podKey(pod)}
                  onChange={e => {
                    setSelectedPod(e.target.value as string);
                    setSelectedContainer('');
                  }}
                >
                  {pods.map(p => (
                    <MenuItem key={podKey(p)} value={podKey(p)}>
                      {p.name} — {p.ready ? 'Ready' : p.phase}
                      {p.restarts > 0 ? `, ${p.restarts} restarts` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {pod.containers.length > 1 && (
                <FormControl style={{ minWidth: 200 }}>
                  <InputLabel id="logs-container">Container</InputLabel>
                  <Select
                    labelId="logs-container"
                    value={container}
                    onChange={e => setSelectedContainer(e.target.value as string)}
                  >
                    {pod.containers.map(c => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Typography variant="body2" color="textSecondary">
                {pod.namespace} · {pod.clusterName}
              </Typography>
            </Box>
            <PodLogs
              key={`${podKey(pod)}/${container}`}
              containerScope={{
                podName: pod.name,
                podNamespace: pod.namespace,
                cluster: { name: pod.clusterName },
                containerName: container,
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
