import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';

type LooseStyle = Record<string, any>;
type StyleValue = LooseStyle | false | null | undefined | StyleValue[];

const addOpacity = (color: unknown, opacity: unknown) => {
  if (typeof color !== 'string' || typeof opacity !== 'number' || opacity >= 1) {
    return typeof color === 'string' ? color : 'rgba(0, 0, 0, 0.18)';
  }

  const hex = color.match(/^#([\da-f]{6})$/i)?.[1];
  if (!hex) {
    return color;
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

const normalizeStyle = (value: Record<string, unknown>): CSSProperties => {
  const style = { ...value } as Record<string, unknown>;

  const copyAxis = (source: string, first: string, second: string) => {
    if (style[source] !== undefined) {
      style[first] = style[source];
      style[second] = style[source];
      delete style[source];
    }
  };

  copyAxis('paddingHorizontal', 'paddingLeft', 'paddingRight');
  copyAxis('paddingVertical', 'paddingTop', 'paddingBottom');
  copyAxis('marginHorizontal', 'marginLeft', 'marginRight');
  copyAxis('marginVertical', 'marginTop', 'marginBottom');

  if (style.resizeMode !== undefined) {
    style.objectFit = style.resizeMode;
    delete style.resizeMode;
  }

  // React Native interprets numeric line heights as pixels. React DOM treats
  // the same values as unitless multipliers, which can make text hundreds of
  // pixels tall (for example, 19 × the font size).
  if (typeof style.lineHeight === 'number') {
    style.lineHeight = `${style.lineHeight}px`;
  }

  if (Array.isArray(style.transform)) {
    style.transform = style.transform
      .map((entry) => {
        const [name, transformValue] = Object.entries(entry as Record<string, unknown>)[0] ?? [];
        if (!name) {
          return '';
        }
        const unit = name.startsWith('rotate') && typeof transformValue === 'number' ? 'deg' : '';
        return `${name}(${String(transformValue)}${unit})`;
      })
      .filter(Boolean)
      .join(' ');
  }

  if (style.shadowColor || style.shadowRadius || style.shadowOffset) {
    const offset = (style.shadowOffset ?? {}) as { width?: number; height?: number };
    const radius = typeof style.shadowRadius === 'number' ? style.shadowRadius : 8;
    const color = addOpacity(style.shadowColor, style.shadowOpacity);
    style.boxShadow = `${offset.width ?? 0}px ${offset.height ?? 4}px ${radius}px ${color}`;
  }

  if (style.textShadowColor || style.textShadowRadius || style.textShadowOffset) {
    const offset = (style.textShadowOffset ?? {}) as { width?: number; height?: number };
    const radius = typeof style.textShadowRadius === 'number' ? style.textShadowRadius : 0;
    style.textShadow = `${offset.width ?? 0}px ${offset.height ?? 1}px ${radius}px ${String(style.textShadowColor ?? 'transparent')}`;
  }

  [
    'shadowColor',
    'shadowOffset',
    'shadowOpacity',
    'shadowRadius',
    'textShadowColor',
    'textShadowOffset',
    'textShadowRadius',
    'elevation',
    'textAlignVertical',
    'includeFontPadding',
  ].forEach((key) => delete style[key]);

  return style as CSSProperties;
};

export const flattenStyle = (value: StyleValue): CSSProperties => {
  if (!value) {
    return {};
  }

  if (Array.isArray(value)) {
    return value.reduce<CSSProperties>((result, item) => ({ ...result, ...flattenStyle(item) }), {});
  }

  return normalizeStyle(value as Record<string, unknown>);
};

export const StyleSheet = {
  create<T extends Record<string, Record<string, unknown>>>(styles: T): T {
    return Object.fromEntries(Object.entries(styles).map(([key, style]) => [key, normalizeStyle(style)])) as T;
  },
};

type AccessibilityProps = {
  accessibilityLabel?: string;
  accessibilityRole?: 'alert' | 'button' | 'tab' | string;
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
  };
};

type ViewProps = Omit<HTMLAttributes<HTMLDivElement>, 'style'> &
  AccessibilityProps & {
    children?: ReactNode;
    collapsable?: boolean;
    pointerEvents?: CSSProperties['pointerEvents'];
    style?: StyleValue;
  };

export const View = forwardRef<HTMLDivElement, ViewProps>(function View(
  { accessibilityLabel, accessibilityRole, accessibilityState, children, collapsable: _collapsable, pointerEvents, style, ...props },
  ref,
) {
  return (
    <div
      {...props}
      aria-disabled={accessibilityState?.disabled}
      aria-label={accessibilityLabel}
      aria-selected={accessibilityState?.selected}
      ref={ref}
      role={accessibilityRole}
      style={{ display: 'flex', flexDirection: 'column', ...flattenStyle(style), pointerEvents }}
    >
      {children}
    </div>
  );
});

const TextNestingContext = createContext(false);

type TextProps = Omit<HTMLAttributes<HTMLSpanElement>, 'style'> &
  AccessibilityProps & {
    children?: ReactNode;
    numberOfLines?: number;
    style?: StyleValue;
  };

export function Text({ accessibilityLabel, accessibilityRole, children, numberOfLines, style, ...props }: TextProps) {
  const nested = useContext(TextNestingContext);
  const lineClampStyle: CSSProperties = numberOfLines
    ? {
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: numberOfLines,
        display: '-webkit-box',
        overflow: 'hidden',
      }
    : {};

  return (
    <TextNestingContext.Provider value>
      <span
        {...props}
        aria-label={accessibilityLabel}
        role={accessibilityRole}
        style={{ display: nested ? 'inline' : 'block', ...flattenStyle(style), ...lineClampStyle }}
      >
        {children}
      </span>
    </TextNestingContext.Provider>
  );
}

type PressableState = { pressed: boolean };
type PressableProps = AccessibilityProps & {
  children?: ReactNode;
  disabled?: boolean;
  hitSlop?: number;
  onPress?: () => void;
  style?: StyleValue | ((state: PressableState) => StyleValue);
};

export function Pressable({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  children,
  disabled,
  hitSlop: _hitSlop,
  onPress,
  style,
}: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;

  return (
    <button
      aria-label={accessibilityLabel}
      aria-selected={accessibilityState?.selected}
      disabled={disabled || accessibilityState?.disabled}
      onBlur={() => setPressed(false)}
      onClick={onPress}
      onMouseDown={() => setPressed(true)}
      onMouseLeave={() => setPressed(false)}
      onMouseUp={() => setPressed(false)}
      onTouchEnd={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      role={accessibilityRole}
      style={{ display: 'flex', flexDirection: 'column', ...flattenStyle(resolvedStyle) }}
      type="button"
    >
      {children}
    </button>
  );
}

export type KeyboardTypeOptions =
  | 'default'
  | 'email-address'
  | 'numeric'
  | 'number-pad'
  | 'decimal-pad'
  | 'numbers-and-punctuation';

export type TextInput = HTMLInputElement | HTMLTextAreaElement;

export type TextInputProps = AccessibilityProps & {
  autoCapitalize?: InputHTMLAttributes<HTMLInputElement>['autoCapitalize'];
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete'];
  autoCorrect?: boolean;
  editable?: boolean;
  importantForAutofill?: string;
  inputRef?: Ref<TextInput>;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  nativeID?: string;
  onBlur?: FocusEventHandler<TextInput>;
  onChangeText: (value: string) => void;
  onFocus?: FocusEventHandler<TextInput>;
  onSubmitEditing?: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  selectionColor?: string;
  secureTextEntry?: boolean;
  style?: StyleValue;
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
  textContentType?: string;
  value: string;
};

const assignRef = <T,>(ref: Ref<T> | undefined, value: T | null) => {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
};

export const TextInput = forwardRef<TextInput, TextInputProps>(function TextInput(
  {
    accessibilityLabel,
    autoCapitalize,
    autoComplete,
    autoCorrect,
    editable = true,
    importantForAutofill: _importantForAutofill,
    keyboardType = 'default',
    multiline,
    nativeID,
    onBlur,
    onChangeText,
    onFocus,
    onSubmitEditing,
    placeholder,
    placeholderTextColor,
    returnKeyType,
    selectionColor,
    secureTextEntry,
    style,
    textAlignVertical: _textAlignVertical,
    textContentType: _textContentType,
    value,
  },
  ref,
) {
  const inputMode: InputHTMLAttributes<HTMLInputElement>['inputMode'] =
    keyboardType === 'email-address'
      ? 'email'
      : keyboardType === 'number-pad' || keyboardType === 'numeric'
        ? 'numeric'
        : keyboardType === 'decimal-pad'
          ? 'decimal'
          : 'text';
  const sharedProps: any = {
    'aria-label': accessibilityLabel,
    autoCapitalize,
    autoComplete,
    autoCorrect: autoCorrect ? 'on' : 'off',
    className: 'web-text-input',
    disabled: !editable,
    enterKeyHint: returnKeyType,
    id: nativeID,
    inputMode,
    name: nativeID ?? autoComplete,
    onBlur,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChangeText(event.target.value),
    onFocus,
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey && onSubmitEditing) {
        event.preventDefault();
        onSubmitEditing();
      }
    },
    placeholder,
    style: {
      ...flattenStyle(style),
      '--placeholder-color': placeholderTextColor,
      caretColor: selectionColor,
    } as CSSProperties,
    value,
  };

  if (multiline) {
    return <textarea {...sharedProps} ref={(node) => assignRef(ref, node)} />;
  }

  return <input {...sharedProps} ref={(node) => assignRef(ref, node)} type={secureTextEntry ? 'password' : keyboardType === 'email-address' ? 'email' : 'text'} />;
});

type ImageProps = AccessibilityProps & {
  source: string | { uri: string };
  style?: StyleValue;
};

export function Image({ accessibilityLabel, source, style }: ImageProps) {
  return <img alt={accessibilityLabel ?? ''} src={typeof source === 'string' ? source : source.uri} style={flattenStyle(style)} />;
}

export type ScrollView = {
  scrollTo(options: { animated?: boolean; y?: number }): void;
};

type ScrollViewProps = {
  children?: ReactNode;
  contentContainerStyle?: StyleValue;
  keyboardShouldPersistTaps?: string;
  showsVerticalScrollIndicator?: boolean;
  style?: StyleValue;
};

export const ScrollView = forwardRef<ScrollView, ScrollViewProps>(function ScrollView(
  {
    children,
    contentContainerStyle,
    keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
    showsVerticalScrollIndicator = true,
    style,
  },
  ref,
) {
  const elementRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollTo({ animated, y = 0 }) {
      elementRef.current?.scrollTo({ behavior: animated ? 'smooth' : 'auto', top: y });
    },
  }));

  return (
    <div
      className={showsVerticalScrollIndicator ? undefined : 'web-scroll-view web-scroll-view-hidden'}
      ref={elementRef}
      style={{
        flex: '1 1 0',
        minHeight: 0,
        minWidth: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        width: '100%',
        ...flattenStyle(style),
      }}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', minWidth: 0, ...flattenStyle(contentContainerStyle) }}
      >
        {children}
      </div>
    </div>
  );
});

export const SafeAreaView = forwardRef<HTMLDivElement, ViewProps>(function SafeAreaView(props, ref) {
  return <View {...props} className={`web-safe-area ${props.className ?? ''}`.trim()} ref={ref} />;
});

type KeyboardAvoidingViewProps = ViewProps & { behavior?: string };

export const KeyboardAvoidingView = forwardRef<HTMLDivElement, KeyboardAvoidingViewProps>(function KeyboardAvoidingView(
  { behavior: _behavior, ...props },
  ref,
) {
  return <View {...props} ref={ref} />;
});

export function useWindowDimensions() {
  const [dimensions, setDimensions] = useState(() => ({ height: window.innerHeight, width: window.innerWidth }));

  useEffect(() => {
    const update = () => setDimensions({ height: window.innerHeight, width: window.innerWidth });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return dimensions;
}

export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: Array<{ onPress?: () => void; style?: 'cancel' | 'destructive' | 'default'; text: string }>,
  ) {
    if (!buttons || buttons.length <= 1) {
      window.alert([title, message].filter(Boolean).join('\n\n'));
      buttons?.[0]?.onPress?.();
      return;
    }

    const action = buttons.find((button) => button.style === 'destructive') ?? buttons.find((button) => button.style !== 'cancel');
    if (window.confirm([title, message].filter(Boolean).join('\n\n'))) {
      action?.onPress?.();
    }
  },
};

export function StatusBar({ backgroundColor }: { backgroundColor?: string; style?: 'auto' | 'dark' | 'light' }) {
  useEffect(() => {
    if (backgroundColor) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', backgroundColor);
    }
  }, [backgroundColor]);

  return null;
}
