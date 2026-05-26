"""
Inventory utility functions for barcode validation and processing.
"""

import re
from django.core.exceptions import ValidationError

# Supported barcode formats
SUPPORTED_BARCODE_FORMATS = [
    'UPC-A',    # 12 digits
    'UPC-E',    # 8 digits  
    'EAN-13',   # 13 digits
    'EAN-8',    # 8 digits
    'Code128',  # Variable length alphanumeric
    'Code39',   # Variable length alphanumeric
    'ITF',      # Interleaved 2 of 5
    'Codabar',  # Variable length numeric
]

def validate_barcode_format(barcode):
    """
    Validate barcode format against supported formats.
    
    Args:
        barcode (str): Barcode string to validate
        
    Returns:
        bool: True if valid format, False otherwise
    """
    if not barcode or not isinstance(barcode, str):
        return False
    
    barcode = barcode.strip()
    
    # UPC-A: 12 digits
    if re.match(r'^\d{12}$', barcode):
        return True
    
    # EAN-13: 13 digits
    if re.match(r'^\d{13}$', barcode):
        return True
    
    # EAN-8: 8 digits
    if re.match(r'^\d{8}$', barcode):
        return True
    
    # Code128: 8-20 alphanumeric characters
    if re.match(r'^[A-Z0-9]{8,20}$', barcode.upper()):
        return True
    
    # Code39: 8-20 alphanumeric with special chars
    if re.match(r'^[A-Z0-9\-\.\$\/\+\%\s]{8,20}$', barcode.upper()):
        return True
    
    return False

def normalize_barcode(barcode):
    """
    Normalize barcode string for consistent storage.
    
    Args:
        barcode (str): Raw barcode string
        
    Returns:
        str: Normalized barcode string
    """
    if not barcode:
        return ''
    
    # Remove whitespace and convert to uppercase
    normalized = barcode.strip().upper()
    
    # Remove common prefixes/suffixes
    normalized = normalized.replace('UPC:', '').replace('EAN:', '')
    
    return normalized

def calculate_check_digit(barcode, format_type='UPC-A'):
    """
    Calculate check digit for barcode validation.
    
    Args:
        barcode (str): Barcode without check digit
        format_type (str): Barcode format type
        
    Returns:
        int: Check digit
    """
    if format_type in ['UPC-A', 'EAN-13']:
        # Calculate UPC/EAN check digit
        digits = [int(d) for d in barcode if d.isdigit()]
        odd_sum = sum(digits[i] for i in range(0, len(digits), 2))
        even_sum = sum(digits[i] for i in range(1, len(digits), 2))
        total = odd_sum + (even_sum * 3)
        return (10 - (total % 10)) % 10
    
    return 0

def validate_barcode_checksum(barcode):
    """
    Validate barcode checksum if applicable.
    
    Args:
        barcode (str): Complete barcode with check digit
        
    Returns:
        bool: True if checksum is valid
    """
    if not barcode or len(barcode) < 8:
        return False
    
    # UPC-A validation
    if len(barcode) == 12 and barcode.isdigit():
        check_digit = int(barcode[-1])
        calculated_digit = calculate_check_digit(barcode[:-1], 'UPC-A')
        return check_digit == calculated_digit
    
    # EAN-13 validation
    if len(barcode) == 13 and barcode.isdigit():
        check_digit = int(barcode[-1])
        calculated_digit = calculate_check_digit(barcode[:-1], 'EAN-13')
        return check_digit == calculated_digit
    
    # For other formats, assume valid if format is correct
    return validate_barcode_format(barcode)

def get_barcode_format(barcode):
    """
    Determine the format of a barcode.
    
    Args:
        barcode (str): Barcode string
        
    Returns:
        str: Barcode format name or 'UNKNOWN'
    """
    if not barcode:
        return 'UNKNOWN'
    
    barcode = barcode.strip()
    
    if re.match(r'^\d{12}$', barcode):
        return 'UPC-A'
    elif re.match(r'^\d{13}$', barcode):
        return 'EAN-13'
    elif re.match(r'^\d{8}$', barcode):
        return 'EAN-8'
    elif re.match(r'^[A-Z0-9]{8,20}$', barcode.upper()):
        return 'Code128'
    elif re.match(r'^[A-Z0-9\-\.\$\/\+\%\s]{8,20}$', barcode.upper()):
        return 'Code39'
    
    return 'UNKNOWN'