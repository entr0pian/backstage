{{/*
Render the container image string.
Usage: {{ include "backstage.image" . }}
*/}}
{{- define "backstage.image" -}}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}
