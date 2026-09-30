{{/*
Render the container image string.
Usage: {{ include "backstage.image" . }}
*/}}
{{- define "backstage.image" -}}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}

{{/*
Environments whose cluster Backstage reaches remotely: every entry in
.Values.environments except the cluster Backstage runs on
(kubernetes.clusterName). Newline-separated; empty unless kubernetes.enabled.
Usage: {{ range (include "backstage.remoteEnvironments" . | splitList "\n" | compact) }}
*/}}
{{- define "backstage.remoteEnvironments" -}}
{{- if .Values.kubernetes.enabled }}
{{- without .Values.environments .Values.kubernetes.clusterName | join "\n" }}
{{- end }}
{{- end }}
