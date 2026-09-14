#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable

from PIL import ImageDraw, ImageFont


class TextLayoutError(RuntimeError):
    pass


@dataclass(frozen=True)
class TextLayout:
    text: str
    font_size: int
    lines: tuple[str, ...]
    bbox: tuple[int, int, int, int]


def _measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, spacing: int) -> tuple[int, int, int, int]:
    if "\n" in text:
        return draw.multiline_textbbox((0, 0), text, font=font, spacing=spacing)
    return draw.textbbox((0, 0), text, font=font)


def _width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> int:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]


def wrap_words(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> tuple[str, ...]:
    paragraphs = str(text or "").splitlines() or [""]
    lines: list[str] = []

    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue

        current = words[0]
        if _width(draw, current, font) > max_width:
            raise TextLayoutError(f"word does not fit text box: {current!r}")

        for word in words[1:]:
            if _width(draw, word, font) > max_width:
                raise TextLayoutError(f"word does not fit text box: {word!r}")
            candidate = f"{current} {word}"
            if _width(draw, candidate, font) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)

    return tuple(lines)


def fit_text_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    font_factory: Callable[[int, bool], ImageFont.FreeTypeFont],
    *,
    max_size: int,
    min_size: int,
    bold: bool = False,
    spacing: int = 6,
    max_lines: int | None = None,
) -> TextLayout:
    x1, y1, x2, y2 = box
    if x2 <= x1 or y2 <= y1:
        raise TextLayoutError(f"invalid text box: {box}")
    width = x2 - x1
    height = y2 - y1

    for size in range(max_size, min_size - 1, -1):
        font = font_factory(size, bold)
        try:
            lines = wrap_words(draw, text, font, width)
        except TextLayoutError:
            continue
        if max_lines is not None and len(lines) > max_lines:
            continue

        wrapped = "\n".join(lines)
        bbox = _measure(draw, wrapped, font, spacing)
        measured_w = bbox[2] - bbox[0]
        measured_h = bbox[3] - bbox[1]
        if measured_w <= width and measured_h <= height:
            return TextLayout(
                text=wrapped,
                font_size=size,
                lines=lines,
                bbox=(x1, y1, x1 + measured_w, y1 + measured_h),
            )

    raise TextLayoutError(
        f"text cannot fit box={box} at min_size={min_size}: {text!r}"
    )


def draw_fitted_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    font_factory: Callable[[int, bool], ImageFont.FreeTypeFont],
    *,
    fill,
    max_size: int,
    min_size: int,
    bold: bool = False,
    spacing: int = 6,
    max_lines: int | None = None,
    align: str = "left",
    valign: str = "top",
) -> TextLayout:
    layout = fit_text_box(
        draw,
        box,
        text,
        font_factory,
        max_size=max_size,
        min_size=min_size,
        bold=bold,
        spacing=spacing,
        max_lines=max_lines,
    )

    x1, y1, x2, y2 = box
    resolved_font = font_factory(layout.font_size, bold)

    # Pillow font metrics often have a positive top bearing (especially Segoe UI on
    # Windows). Position the actual ink bounds, not the nominal baseline origin.
    local_bbox = draw.multiline_textbbox(
        (0, 0),
        layout.text,
        font=resolved_font,
        spacing=spacing,
        align=align,
    )
    text_w = local_bbox[2] - local_bbox[0]
    text_h = local_bbox[3] - local_bbox[1]

    if align == "center":
        target_left = x1 + (x2 - x1 - text_w) / 2
    elif align == "right":
        target_left = x2 - text_w
    else:
        target_left = x1

    if valign == "middle":
        target_top = y1 + (y2 - y1 - text_h) / 2
    elif valign == "bottom":
        target_top = y2 - text_h
    else:
        target_top = y1

    x = target_left - local_bbox[0]
    y = target_top - local_bbox[1]

    draw.multiline_text(
        (x, y),
        layout.text,
        font=resolved_font,
        fill=fill,
        spacing=spacing,
        align=align,
    )

    # Re-measure at the actual draw origin. Any overflow is a hard Rat Art error.
    actual = draw.multiline_textbbox(
        (x, y),
        layout.text,
        font=resolved_font,
        spacing=spacing,
        align=align,
    )
    epsilon = 1
    if (
        actual[0] < x1 - epsilon
        or actual[1] < y1 - epsilon
        or actual[2] > x2 + epsilon
        or actual[3] > y2 + epsilon
    ):
        raise TextLayoutError(
            f"drawn text escaped box={box}; actual={tuple(round(v, 2) for v in actual)} text={text!r}"
        )

    return layout
