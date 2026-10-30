/** Install check fixture: the marker service exists only when the install applied at once and this plugin ran. */
export function apply(ctx) {
  ctx.provide('widgetRowsInstallMarker', 'ran')
}
