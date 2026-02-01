<script>
  /**
   * @typedef {Object} Props
   * @property {boolean} [disabled] - Whether the icon is in disabled state
   * @property {number} [size] - Width of the icon in pixels (height is auto-calculated)
   */

  /** @type {Props} */
  let { disabled = false, size = 128 } = $props();

  // Calculate height automatically maintaining 7:9 aspect ratio
  let height = $derived(size * 1.286);
</script>

<svg
  width={size}
  height={height}
  viewBox="0 0 140 180"
  xmlns="http://www.w3.org/2000/svg"
  class="transition-colors duration-200 ease-in-out"
  class:text-neutral-300={disabled}
  class:dark:text-neutral-700={disabled}
  class:text-neutral-900={!disabled}
  class:dark:text-neutral-100={!disabled}
  aria-label={disabled ? 'Kobo device (disabled)' : 'Kobo device'}
  role="img"
>
  <!-- Device outline -->
  <rect
    x="5"
    y="5"
    width="130"
    height="170"
    rx="8"
    fill="none"
    stroke="currentColor"
    stroke-width="3"
  />

  <!-- Screen area -->
  <rect
    x="15"
    y="15"
    width="110"
    height="140"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />

  <!-- 7 text lines representing content -->
  <line x1="25" y1="30" x2="115" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <line x1="25" y1="50" x2="115" y2="50" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <line x1="25" y1="70" x2="115" y2="70" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <line x1="25" y1="90" x2="115" y2="90" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <line x1="25" y1="110" x2="115" y2="110" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <line x1="25" y1="130" x2="95" y2="130" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <line x1="25" y1="150" x2="105" y2="150" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
</svg>
