"""Restricted AST-allowlisted mathematical expression parser and evaluator.

Security guarantee:
- NEVER calls eval(), exec(), compile(), or getattr().
- Parses expressions via Python ast.parse(..., mode="eval") and walks ONLY an
  explicit allowlist of mathematical AST nodes and pure scalar functions.
- Rejects attribute access, comprehensions, lambdas, imports, indexing,
  strings, unsafe power exponents, and unknown identifiers.
"""

from __future__ import annotations

import ast
import math
import re
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Set

MAX_EXPRESSION_LENGTH = 512
MAX_AST_NODES = 128
MAX_EXPONENT = 100.0
IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

RESERVED_NAMES: Set[str] = {
    "t",
    "dt",
    "pi",
    "e",
    "min",
    "max",
    "abs",
    "sqrt",
    "exp",
    "log",
    "ln",
    "log10",
    "sin",
    "cos",
    "tan",
    "pow",
    "round",
    "floor",
    "ceil",
    "clamp",
    "safe_div",
    "step",
}


def _safe_sqrt(x: float) -> float:
    if x < 0:
        raise ValueError(f"sqrt domain error: negative input ({x})")
    return math.sqrt(x)


def _safe_exp(x: float) -> float:
    clamped = max(-700.0, min(700.0, x))
    return math.exp(clamped)


def _safe_log(x: float) -> float:
    if x <= 0:
        raise ValueError(f"log domain error: non-positive input ({x})")
    return math.log(x)


def _safe_log10(x: float) -> float:
    if x <= 0:
        raise ValueError(f"log10 domain error: non-positive input ({x})")
    return math.log10(x)


def _safe_pow(base: float, exp_val: float) -> float:
    if abs(exp_val) > MAX_EXPONENT:
        raise ValueError(f"Exponent {exp_val} exceeds safe bound ({MAX_EXPONENT})")
    if base < 0 and not float(exp_val).is_integer():
        raise ValueError("Fractional exponent of negative base is not supported")
    result = math.pow(base, exp_val)
    if not math.isfinite(result):
        raise ValueError("Power operation produced non-finite result")
    return result


def _clamp(x: float, lo: float, hi: float) -> float:
    if lo > hi:
        lo, hi = hi, lo
    return max(lo, min(hi, x))


def _safe_div(num: float, den: float, fallback: float = 0.0) -> float:
    if abs(den) < 1e-12:
        return fallback
    return num / den


def _step_fn(t_val: float, threshold: float) -> float:
    return 1.0 if t_val >= threshold else 0.0


ALLOWED_FUNCTIONS: Dict[str, Callable[..., float]] = {
    "min": lambda *args: float(min(args)),
    "max": lambda *args: float(max(args)),
    "abs": lambda x: abs(float(x)),
    "sqrt": _safe_sqrt,
    "exp": _safe_exp,
    "log": _safe_log,
    "ln": _safe_log,
    "log10": _safe_log10,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "pow": _safe_pow,
    "round": lambda x, n=0: float(round(float(x), int(n))),
    "floor": lambda x: float(math.floor(float(x))),
    "ceil": lambda x: float(math.ceil(float(x))),
    "clamp": _clamp,
    "safe_div": _safe_div,
    "step": _step_fn,
}

ALLOWED_CONSTANTS: Dict[str, float] = {
    "pi": math.pi,
    "e": math.e,
}

ALLOWED_NODE_TYPES = (
    ast.Expression,
    ast.BinOp,
    ast.UnaryOp,
    ast.Add,
    ast.Sub,
    ast.Mult,
    ast.Div,
    ast.Mod,
    ast.Pow,
    ast.UAdd,
    ast.USub,
    ast.Constant,
    ast.Name,
    ast.Load,
    ast.Call,
    ast.Compare,
    ast.Lt,
    ast.LtE,
    ast.Gt,
    ast.GtE,
    ast.Eq,
    ast.NotEq,
    ast.IfExp,
    ast.BoolOp,
    ast.And,
    ast.Or,
    ast.Not,
)


class UnsafeExpressionError(ValueError):
    """Raised when an expression contains disallowed AST constructs."""


@dataclass
class ParsedExpression:
    source: str
    tree: ast.Expression
    references: Set[str] = field(default_factory=set)
    has_division: bool = False
    division_denominators: List[str] = field(default_factory=list)


def validate_identifier(identifier: str) -> bool:
    return bool(IDENTIFIER_RE.match(identifier)) and identifier not in RESERVED_NAMES


def parse_expression(expr: str) -> ParsedExpression:
    if not isinstance(expr, str) or not expr.strip():
        raise UnsafeExpressionError("Expression must be a non-empty string")
    cleaned = expr.strip()
    if len(cleaned) > MAX_EXPRESSION_LENGTH:
        raise UnsafeExpressionError(
            f"Expression length ({len(cleaned)}) exceeds limit ({MAX_EXPRESSION_LENGTH})"
        )

    try:
        tree = ast.parse(cleaned, mode="eval")
    except SyntaxError as exc:
        raise UnsafeExpressionError(f"Syntax error in expression: {exc.msg}") from exc

    node_count = 0
    references: Set[str] = set()
    has_division = False
    division_denominators: List[str] = []

    for node in ast.walk(tree):
        node_count += 1
        if node_count > MAX_AST_NODES:
            raise UnsafeExpressionError(
                f"Expression complexity ({node_count} AST nodes) exceeds limit ({MAX_AST_NODES})"
            )

        if not isinstance(node, ALLOWED_NODE_TYPES):
            raise UnsafeExpressionError(
                f"Disallowed construct '{type(node).__name__}' in mathematical expression"
            )

        if isinstance(node, ast.Constant):
            if not isinstance(node.value, (int, float)) or isinstance(node.value, bool):
                raise UnsafeExpressionError(
                    f"Only numeric literals are allowed, got {type(node.value).__name__}"
                )

        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name):
                raise UnsafeExpressionError(
                    "Only direct calls to allowlisted mathematical functions are permitted"
                )
            if node.func.id not in ALLOWED_FUNCTIONS:
                raise UnsafeExpressionError(
                    f"Function '{node.func.id}' is not in the mathematical allowlist"
                )
            if node.keywords:
                raise UnsafeExpressionError("Keyword arguments are not supported in equations")

        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
            has_division = True
            try:
                division_denominators.append(ast.unparse(node.right))
            except Exception:
                division_denominators.append("<denominator>")

    # Collect variable references (excluding function names being called and constants)
    called_func_nodes = {
        node.func for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node not in called_func_nodes:
            if node.id not in ALLOWED_CONSTANTS and node.id not in ("t", "dt"):
                references.add(node.id)

    return ParsedExpression(
        source=cleaned,
        tree=tree,
        references=references,
        has_division=has_division,
        division_denominators=division_denominators,
    )


def evaluate_expression(parsed: ParsedExpression, env: Dict[str, float]) -> float:
    val = _eval_node(parsed.tree.body, env)
    result = float(val)
    if not math.isfinite(result):
        raise ValueError(f"Non-finite numerical result in expression '{parsed.source}'")
    return result


def _eval_node(node: ast.AST, env: Dict[str, float]) -> float:
    if isinstance(node, ast.Constant):
        return float(node.value)

    if isinstance(node, ast.Name):
        if node.id in ALLOWED_CONSTANTS:
            return ALLOWED_CONSTANTS[node.id]
        if node.id in env:
            return float(env[node.id])
        raise ValueError(f"Unresolved variable '{node.id}'")

    if isinstance(node, ast.UnaryOp):
        operand = _eval_node(node.operand, env)
        if isinstance(node.op, ast.UAdd):
            return +operand
        if isinstance(node.op, ast.USub):
            return -operand
        if isinstance(node.op, ast.Not):
            return 0.0 if operand else 1.0
        raise UnsafeExpressionError(f"Unsupported unary operator {type(node.op).__name__}")

    if isinstance(node, ast.BinOp):
        left = _eval_node(node.left, env)
        right = _eval_node(node.right, env)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            if abs(right) < 1e-12:
                raise ZeroDivisionError("Division by zero detected during numerical evaluation")
            return left / right
        if isinstance(node.op, ast.Mod):
            if abs(right) < 1e-12:
                raise ZeroDivisionError("Modulo by zero detected during numerical evaluation")
            return left % right
        if isinstance(node.op, ast.Pow):
            return _safe_pow(left, right)
        raise UnsafeExpressionError(f"Unsupported binary operator {type(node.op).__name__}")

    if isinstance(node, ast.Compare):
        left = _eval_node(node.left, env)
        for op, comparator in zip(node.ops, node.comparators):
            right = _eval_node(comparator, env)
            ok = False
            if isinstance(op, ast.Lt):
                ok = left < right
            elif isinstance(op, ast.LtE):
                ok = left <= right
            elif isinstance(op, ast.Gt):
                ok = left > right
            elif isinstance(op, ast.GtE):
                ok = left >= right
            elif isinstance(op, ast.Eq):
                ok = abs(left - right) < 1e-12
            elif isinstance(op, ast.NotEq):
                ok = abs(left - right) >= 1e-12
            else:
                raise UnsafeExpressionError(f"Unsupported comparison operator {type(op).__name__}")
            if not ok:
                return 0.0
            left = right
        return 1.0

    if isinstance(node, ast.BoolOp):
        if isinstance(node.op, ast.And):
            for v in node.values:
                if not _eval_node(v, env):
                    return 0.0
            return 1.0
        if isinstance(node.op, ast.Or):
            for v in node.values:
                if _eval_node(v, env):
                    return 1.0
            return 0.0
        raise UnsafeExpressionError(f"Unsupported boolean operator {type(node.op).__name__}")

    if isinstance(node, ast.IfExp):
        cond = _eval_node(node.test, env)
        return _eval_node(node.body, env) if cond else _eval_node(node.orelse, env)

    if isinstance(node, ast.Call):
        assert isinstance(node.func, ast.Name)
        fn = ALLOWED_FUNCTIONS[node.func.id]
        args = [_eval_node(arg, env) for arg in node.args]
        if not args:
            raise ValueError(f"Function '{node.func.id}' requires at least one argument")
        return float(fn(*args))

    raise UnsafeExpressionError(f"Unsupported AST node {type(node).__name__}")
